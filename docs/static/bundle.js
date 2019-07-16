/*
GOAL: This module should mirror the NodeJS module system according the documented behavior.
The module transport will send down code that registers module definitions by an assigned path. In addition,
the module transport will send down code that registers additional metadata to allow the module resolver to
resolve modules in the browser. Additional metadata includes the following:

- "mains": The mapping of module directory paths to a fully resolved module path
- "remaps": The remapping of one fully resolved module path to another fully resolved module path (used for browser overrides)
- "run": A list of entry point modules that should be executed when ready

Inspired by:
https://github.com/joyent/node/blob/master/lib/module.js
*/
(function() {
    var win;

    if (typeof window !== 'undefined') {
        win = window;

        // This lasso modules client has already been loaded on the page. Do nothing;
        if (win.$_mod) {
            return;
        }

        win.global = win;
    }

    /** the module runtime */
    var $_mod;

    // this object stores the module factories with the keys being module paths and
    // values being a factory function or object (e.g. "/baz$3.0.0/lib/index" --> Function)
    var definitions = {};

    // Search path that will be checked when looking for modules
    var searchPaths = [];

    // The _ready flag is used to determine if "run" modules can
    // be executed or if they should be deferred until all dependencies
    // have been loaded
    var _ready = false;

    // If $_mod.run() is called when the page is not ready then
    // we queue up the run modules to be executed later
    var runQueue = [];

    // this object stores the Module instance cache with the keys being paths of modules (e.g., "/foo$1.0.0/bar" --> Module)
    var instanceCache = {};

    // This object maps installed dependencies to specific versions
    //
    // For example:
    // {
    //   // The package "foo" with version 1.0.0 has an installed package named "bar" (foo/node_modules/bar") and
    //   // the version of "bar" is 3.0.0
    //   "/foo$1.0.0/bar": "3.0.0"
    // }
    var installed = {};

    // Maps builtin modules such as "path", "buffer" to their fully resolved paths
    var builtins = {};

    // this object maps a directory to the fully resolved module path
    //
    // For example:
    //
    var mains = {};

    // used to remap a one fully resolved module path to another fully resolved module path
    var remapped = {};

    var cacheByDirname = {};

    // When a module is mapped to a global varialble we add a reference
    // that maps the path of the module to the loaded global instance.
    // We use this mapping to ensure that global modules are only loaded
    // once if they map to the same path.
    //
    // See issue #5 - Ensure modules mapped to globals only load once
    // https://github.com/raptorjs/raptor-modules/issues/5
    var loadedGlobalsByRealPath = {};

    function moduleNotFoundError(target, from) {
        var err = new Error('Cannot find module "' + target + '"' + (from ? ' from "' + from + '"' : ''));

        err.code = 'MODULE_NOT_FOUND';
        return err;
    }

    function Module(filename) {
       /*
        A Node module has these properties:
        - filename: The path of the module
        - id: The path of the module (same as filename)
        - exports: The exports provided during load
        - loaded: Has module been fully loaded (set to false until factory function returns)

        NOT SUPPORTED:
        - parent: parent Module
        - paths: The search path used by this module (NOTE: not documented in Node.js module system so we don't need support)
        - children: The modules that were required by this module
        */
        this.id = this.filename = filename;
        this.loaded = false;
        this.exports = undefined;
    }

    Module.cache = instanceCache;

    // temporary variable for referencing the Module prototype
    var Module_prototype = Module.prototype;

    Module_prototype.load = function(factoryOrObject) {
        var filename = this.id;

        if (factoryOrObject && factoryOrObject.constructor === Function) {
            // factoryOrObject is definitely a function
            var lastSlashPos = filename.lastIndexOf('/');

            // find the value for the __dirname parameter to factory
            var dirname = filename.substring(0, lastSlashPos);

            // local cache for requires initiated from this module/dirname
            var localCache = cacheByDirname[dirname] || (cacheByDirname[dirname] = {});

            // this is the require used by the module
            var instanceRequire = function(target) {
                // Only store the `module` in the local cache since `module.exports` may not be accurate
                // if there was a circular dependency
                var module = localCache[target] || (localCache[target] = requireModule(target, dirname));
                return module.exports;
            };

            // The require method should have a resolve method that will return the resolved
            // path but not actually instantiate the module.
            // This resolve function will make sure a definition exists for the corresponding
            // path of the target but it will not instantiate a new instance of the target.
            instanceRequire.resolve = function(target) {
                if (!target) {
                    throw moduleNotFoundError('');
                }

                var resolved = resolve(target, dirname);

                if (!resolved) {
                    throw moduleNotFoundError(target, dirname);
                }

                // NOTE: resolved[0] is the path and resolved[1] is the module factory
                return resolved[0];
            };

            // NodeJS provides access to the cache as a property of the "require" function
            instanceRequire.cache = instanceCache;

            // Expose the module system runtime via the `runtime` property
            // TODO: We should deprecate this in favor of `Module.prototype.__runtime`
            // @deprecated
            instanceRequire.runtime = $_mod;

            // $_mod.def("/foo$1.0.0/lib/index", function(require, exports, module, __filename, __dirname) {
            this.exports = {};

            // call the factory function
            factoryOrObject.call(this, instanceRequire, this.exports, this, filename, dirname);
        } else {
            // factoryOrObject is not a function so have exports reference factoryOrObject
            this.exports = factoryOrObject;
        }

        this.loaded = true;
    };

    /**
     * Defines a packages whose metadata is used by raptor-loader to load the package.
     */
    function define(path, factoryOrObject, options) {
        /*
        $_mod.def('/baz$3.0.0/lib/index', function(require, exports, module, __filename, __dirname) {
            // module source code goes here
        });
        */

        var globals = options && options.globals;

        definitions[path] = factoryOrObject;

        if (globals) {
            var target = win || global;
            for (var i=0;i<globals.length; i++) {
                var globalVarName = globals[i];
                var globalModule = loadedGlobalsByRealPath[path] = requireModule(path);
                target[globalVarName] = globalModule.exports;
            }
        }
    }

    function registerMain(path, relativePath) {
        mains[path] = relativePath;
    }

    function remap(fromPath, toPath) {
        remapped[fromPath] = toPath;
    }

    function builtin(name, target) {
        builtins[name] = target;
    }

    function registerInstalledDependency(parentPath, packageName, packageVersion) {
        // Example:
        // dependencies['/my-package$1.0.0/$/my-installed-package'] = '2.0.0'
        installed[parentPath + '/' + packageName] =  packageVersion;
    }

    /**
     * This function will take an array of path parts and normalize them by handling handle ".." and "."
     * and then joining the resultant string.
     *
     * @param {Array} parts an array of parts that presumedly was split on the "/" character.
     */
    function normalizePathParts(parts) {

        // IMPORTANT: It is assumed that parts[0] === "" because this method is used to
        // join an absolute path to a relative path
        var i;
        var len = 0;

        var numParts = parts.length;

        for (i = 0; i < numParts; i++) {
            var part = parts[i];

            if (part === '.') {
                // ignore parts with just "."
                /*
                // if the "." is at end of parts (e.g. ["a", "b", "."]) then trim it off
                if (i === numParts - 1) {
                    //len--;
                }
                */
            } else if (part === '..') {
                // overwrite the previous item by decrementing length
                len--;
            } else {
                // add this part to result and increment length
                parts[len] = part;
                len++;
            }
        }

        if (len === 1) {
            // if we end up with just one part that is empty string
            // (which can happen if input is ["", "."]) then return
            // string with just the leading slash
            return '/';
        } else if (len > 2) {
            // parts i s
            // ["", "a", ""]
            // ["", "a", "b", ""]
            if (parts[len - 1].length === 0) {
                // last part is an empty string which would result in trailing slash
                len--;
            }
        }

        // truncate parts to remove unused
        parts.length = len;
        return parts.join('/');
    }

    function join(from, target) {
        var targetParts = target.split('/');
        var fromParts = from == '/' ? [''] : from.split('/');
        return normalizePathParts(fromParts.concat(targetParts));
    }

    function withoutExtension(path) {
        var lastDotPos = path.lastIndexOf('.');
        var lastSlashPos;

        /* jshint laxbreak:true */
        return ((lastDotPos === -1) || ((lastSlashPos = path.lastIndexOf('/')) !== -1) && (lastSlashPos > lastDotPos))
            ? null // use null to indicate that returned path is same as given path
            : path.substring(0, lastDotPos);
    }

    function splitPackageIdAndSubpath(path) {
        path = path.substring(1); /* Skip past the first slash */
        // Examples:
        //     '/my-package$1.0.0/foo/bar' --> ['my-package$1.0.0', '/foo/bar']
        //     '/my-package$1.0.0' --> ['my-package$1.0.0', '']
        //     '/my-package$1.0.0/' --> ['my-package$1.0.0', '/']
        //     '/@my-scoped-package/foo/$1.0.0/' --> ['@my-scoped-package/foo$1.0.0', '/']
        var slashPos = path.indexOf('/');

        if (path.charAt(1) === '@') {
            // path is something like "/@my-user-name/my-scoped-package/subpath"
            // For scoped packages, the package name is two parts. We need to skip
            // past the second slash to get the full package name
            slashPos = path.indexOf('/', slashPos+1);
        }

        var packageIdEnd = slashPos === -1 ? path.length : slashPos;

        return [
            path.substring(0, packageIdEnd), // Everything up to the slash
            path.substring(packageIdEnd) // Everything after the package ID
        ];
    }

    function resolveInstalledModule(target, from) {
        // Examples:
        // target='foo', from='/my-package$1.0.0/hello/world'

        if (target.charAt(target.length-1) === '/') {
            // This is a hack because I found require('util/') in the wild and
            // it did not work because of the trailing slash
            target = target.slice(0, -1);
        }

        // Check to see if the target module is a builtin module.
        // For example:
        // builtins['path'] = '/path-browserify$0.0.0/index'
        var builtinPath = builtins[target];
        if (builtinPath) {
            return builtinPath;
        }

        var fromParts = splitPackageIdAndSubpath(from);
        var fromPackageId = fromParts[0];


        var targetSlashPos = target.indexOf('/');
        var targetPackageName;
        var targetSubpath;

        if (targetSlashPos < 0) {
            targetPackageName = target;
            targetSubpath = '';
        } else {

            if (target.charAt(0) === '@') {
                // target is something like "@my-user-name/my-scoped-package/subpath"
                // For scoped packages, the package name is two parts. We need to skip
                // past the first slash to get the full package name
                targetSlashPos = target.indexOf('/', targetSlashPos + 1);
            }

            targetPackageName = target.substring(0, targetSlashPos);
            targetSubpath = target.substring(targetSlashPos);
        }

        var targetPackageVersion = installed[fromPackageId + '/' + targetPackageName];
        if (targetPackageVersion) {
            var resolvedPath = '/' + targetPackageName + '$' + targetPackageVersion;
            if (targetSubpath) {
                resolvedPath += targetSubpath;
            }
            return resolvedPath;
        }
    }

    function resolve(target, from) {
        var resolvedPath;

        if (target.charAt(0) === '.') {
            // turn relative path into absolute path
            resolvedPath = join(from, target);
        } else if (target.charAt(0) === '/') {
            // handle targets such as "/my/file" or "/$/foo/$/baz"
            resolvedPath = normalizePathParts(target.split('/'));
        } else {
            var len = searchPaths.length;
            for (var i = 0; i < len; i++) {
                // search path entries always end in "/";
                var candidate = searchPaths[i] + target;
                var resolved = resolve(candidate, from);
                if (resolved) {
                    return resolved;
                }
            }

            resolvedPath = resolveInstalledModule(target, from);
        }

        if (!resolvedPath) {
            return undefined;
        }

        // target is something like "/foo/baz"
        // There is no installed module in the path
        var relativePath;

        // check to see if "target" is a "directory" which has a registered main file
        if ((relativePath = mains[resolvedPath]) !== undefined) {
            if (!relativePath) {
                relativePath = 'index';
            }

            // there is a main file corresponding to the given target so add the relative path
            resolvedPath = join(resolvedPath, relativePath);
        }

        var remappedPath = remapped[resolvedPath];
        if (remappedPath) {
            resolvedPath = remappedPath;
        }

        var factoryOrObject = definitions[resolvedPath];
        if (factoryOrObject === undefined) {
            // check for definition for given path but without extension
            var resolvedPathWithoutExtension;
            if (((resolvedPathWithoutExtension = withoutExtension(resolvedPath)) === null) ||
                ((factoryOrObject = definitions[resolvedPathWithoutExtension]) === undefined)) {
                return undefined;
            }

            // we found the definition based on the path without extension so
            // update the path
            resolvedPath = resolvedPathWithoutExtension;
        }

        return [resolvedPath, factoryOrObject];
    }

    function requireModule(target, from) {
        if (!target) {
            throw moduleNotFoundError('');
        }

        var resolved = resolve(target, from);
        if (!resolved) {
            throw moduleNotFoundError(target, from);
        }

        var resolvedPath = resolved[0];

        var module = instanceCache[resolvedPath];

        if (module !== undefined) {
            // found cached entry based on the path
            return module;
        }

        // Fixes issue #5 - Ensure modules mapped to globals only load once
        // https://github.com/raptorjs/raptor-modules/issues/5
        //
        // If a module is mapped to a global variable then we want to always
        // return that global instance of the module when it is being required
        // to avoid duplicate modules being loaded. For modules that are mapped
        // to global variables we also add an entry that maps the path
        // of the module to the global instance of the loaded module.

        if (loadedGlobalsByRealPath.hasOwnProperty(resolvedPath)) {
            return loadedGlobalsByRealPath[resolvedPath];
        }

        var factoryOrObject = resolved[1];

        module = new Module(resolvedPath);

        // cache the instance before loading (allows support for circular dependency with partial loading)
        instanceCache[resolvedPath] = module;

        module.load(factoryOrObject);

        return module;
    }

    function require(target, from) {
        var module = requireModule(target, from);
        return module.exports;
    }

    /*
    $_mod.run('/$/installed-module', '/src/foo');
    */
    function run(path, options) {
        var wait = !options || (options.wait !== false);
        if (wait && !_ready) {
            return runQueue.push([path, options]);
        }

        require(path, '/');
    }

    /*
     * Mark the page as being ready and execute any of the
     * run modules that were deferred
     */
    function ready() {
        _ready = true;

        var len;
        while((len = runQueue.length)) {
            // store a reference to the queue before we reset it
            var queue = runQueue;

            // clear out the queue
            runQueue = [];

            // run all of the current jobs
            for (var i = 0; i < len; i++) {
                var args = queue[i];
                run(args[0], args[1]);
            }

            // stop running jobs in the queue if we change to not ready
            if (!_ready) {
                break;
            }
        }
    }

    function addSearchPath(prefix) {
        searchPaths.push(prefix);
    }

    var pendingCount = 0;
    var onPendingComplete = function() {
        pendingCount--;
        if (!pendingCount) {
            // Trigger any "require-run" modules in the queue to run
            ready();
        }
    };

    /*
     * $_mod is the short-hand version that that the transport layer expects
     * to be in the browser window object
     */
    Module_prototype.__runtime = $_mod = {
        /**
         * Used to register a module factory/object (*internal*)
         */
        def: define,

        /**
         * Used to register an installed dependency (e.g. "/$/foo" depends on "baz") (*internal*)
         */
        installed: registerInstalledDependency,
        run: run,
        main: registerMain,
        remap: remap,
        builtin: builtin,
        require: require,
        resolve: resolve,
        join: join,
        ready: ready,

        /**
         * Add a search path entry (internal)
         */
        searchPath: addSearchPath,

        /**
         * Sets the loader metadata for this build.
         *
         * @param asyncPackageName {String} name of asynchronous package
         * @param contentType {String} content type ("js" or "css")
         * @param bundleUrl {String} URL of bundle that belongs to package
         */
        loaderMetadata: function(data) {
            // We store loader metadata in the prototype of Module
            // so that `lasso-loader` can read it from
            // `module.__loaderMetadata`.
            Module_prototype.__loaderMetadata = data;
        },

        /**
         * Asynchronous bundle loaders should call `pending()` to instantiate
         * a new job. The object we return here has a `done` method that
         * should be called when the job completes. When the number of
         * pending jobs drops to 0, we invoke any of the require-run modules
         * that have been declared.
         */
        pending: function() {
            _ready = false;
            pendingCount++;
            return {
                done: onPendingComplete
            };
        }
    };

    if (win) {
        win.$_mod = $_mod;
    } else {
        module.exports = $_mod;
    }
})();

$_mod.installed("makeup-active-descendant$0.2.1", "nodelist-foreach-polyfill", "1.2.0");
$_mod.main("/nodelist-foreach-polyfill$1.2.0", "");
$_mod.def("/nodelist-foreach-polyfill$1.2.0/index", function(require, exports, module, __filename, __dirname) { if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = function (callback, thisArg) {
        thisArg = thisArg || window;
        for (var i = 0; i < this.length; i++) {
            callback.call(thisArg, this[i], i, this);
        }
    };
}

});
$_mod.run("/nodelist-foreach-polyfill$1.2.0/index");
$_mod.installed("makeup-active-descendant$0.2.1", "custom-event-polyfill", "1.0.7");
$_mod.main("/custom-event-polyfill$1.0.7", "polyfill");
$_mod.def("/custom-event-polyfill$1.0.7/polyfill", function(require, exports, module, __filename, __dirname) { // Polyfill for creating CustomEvents on IE9/10/11

// code pulled from:
// https://github.com/d4tocchini/customevent-polyfill
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent#Polyfill

(function() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    var ce = new window.CustomEvent('test', { cancelable: true });
    ce.preventDefault();
    if (ce.defaultPrevented !== true) {
      // IE has problems with .preventDefault() on custom events
      // http://stackoverflow.com/questions/23349191
      throw new Error('Could not prevent default');
    }
  } catch (e) {
    var CustomEvent = function(event, params) {
      var evt, origPrevent;
      params = params || {};
      params.bubbles = !!params.bubbles;
      params.cancelable = !!params.cancelable;

      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(
        event,
        params.bubbles,
        params.cancelable,
        params.detail
      );
      origPrevent = evt.preventDefault;
      evt.preventDefault = function() {
        origPrevent.call(this);
        try {
          Object.defineProperty(this, 'defaultPrevented', {
            get: function() {
              return true;
            }
          });
        } catch (e) {
          this.defaultPrevented = true;
        }
      };
      return evt;
    };

    CustomEvent.prototype = window.Event.prototype;
    window.CustomEvent = CustomEvent; // expose definition to window
  }
})();

});
$_mod.run("/custom-event-polyfill$1.0.7/polyfill");
$_mod.installed("makeup-active-descendant$0.2.1", "makeup-navigation-emitter", "0.3.0");
$_mod.main("/makeup-navigation-emitter$0.3.0", "");
$_mod.installed("makeup-navigation-emitter$0.3.0", "custom-event-polyfill", "1.0.7");
$_mod.installed("makeup-navigation-emitter$0.3.0", "nodelist-foreach-polyfill", "1.2.0");
$_mod.installed("makeup-navigation-emitter$0.3.0", "makeup-key-emitter", "0.1.0");
$_mod.main("/makeup-key-emitter$0.1.0", "");
$_mod.installed("makeup-key-emitter$0.1.0", "custom-event-polyfill", "1.0.7");
$_mod.def("/makeup-key-emitter$0.1.0/util", function(require, exports, module, __filename, __dirname) { 'use strict';

/*
    IE uses a different naming scheme for KeyboardEvent.key so we map the keyCode instead
    https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
 */

var keyCodeToKeyMap = {
    '13': 'Enter',
    '27': 'Escape',
    '32': 'Spacebar',
    '33': 'PageUp',
    '34': 'PageDown',
    '35': 'End',
    '36': 'Home',
    '37': 'ArrowLeft',
    '38': 'ArrowUp',
    '39': 'ArrowRight',
    '40': 'ArrowDown'
};

function uncapitalizeFirstLetter(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

module.exports = {
    keyCodeToKeyMap: keyCodeToKeyMap,
    uncapitalizeFirstLetter: uncapitalizeFirstLetter
};

});
$_mod.def("/makeup-key-emitter$0.1.0/index", function(require, exports, module, __filename, __dirname) { 'use strict';

// requires CustomEvent polyfill for IE9+
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent

var util = require('/makeup-key-emitter$0.1.0/util'/*'./util.js'*/);

function onKeyDownOrUp(evt, el, keyEventType) {
    if (!evt.shiftKey) {
        var key = util.keyCodeToKeyMap[evt.keyCode];

        switch (key) {
            case 'Enter':
            case 'Escape':
            case 'Spacebar':
            case 'PageUp':
            case 'PageDown':
            case 'End':
            case 'Home':
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowRight':
            case 'ArrowDown':
                el.dispatchEvent(new CustomEvent(util.uncapitalizeFirstLetter(key + 'Key' + keyEventType), {
                    detail: evt,
                    bubbles: true
                }));
                break;
            default:
                return;
        }
    }
}

function onKeyDown(e) {
    onKeyDownOrUp(e, this, "Down");
}

function onKeyUp(e) {
    onKeyDownOrUp(e, this, "Up");
}

function addKeyDown(el) {
    el.addEventListener('keydown', onKeyDown);
}

function addKeyUp(el) {
    el.addEventListener('keyup', onKeyUp);
}

function removeKeyDown(el) {
    el.removeEventListener('keydown', onKeyDown);
}

function removeKeyUp(el) {
    el.removeEventListener('keyup', onKeyUp);
}

function add(el) {
    addKeyDown(el);
    addKeyUp(el);
}

function remove(el) {
    removeKeyDown(el);
    removeKeyUp(el);
}

module.exports = {
    addKeyDown: addKeyDown,
    addKeyUp: addKeyUp,
    removeKeyDown: removeKeyDown,
    removeKeyUp: removeKeyUp,
    add: add,
    remove: remove
};

});
$_mod.installed("makeup-navigation-emitter$0.3.0", "makeup-exit-emitter", "0.2.0");
$_mod.main("/makeup-exit-emitter$0.2.0", "");
$_mod.installed("makeup-exit-emitter$0.2.0", "custom-event-polyfill", "1.0.7");
$_mod.installed("makeup-exit-emitter$0.2.0", "makeup-next-id", "0.1.1");
$_mod.main("/makeup-next-id$0.1.1", "");
$_mod.installed("makeup-next-id$0.1.1", "nanoid", "2.0.3");
$_mod.main("/nanoid$2.0.3", "");
$_mod.remap("/nanoid$2.0.3/index", "/nanoid$2.0.3/index.browser");
$_mod.builtin("process", "/process$0.11.10/browser");
$_mod.def("/process$0.11.10/browser", function(require, exports, module, __filename, __dirname) { // shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

});
$_mod.def("/nanoid$2.0.3/index.browser", function(require, exports, module, __filename, __dirname) { var process=require("process"); if (process.env.NODE_ENV !== 'production') {
  if (typeof self === 'undefined' || (!self.crypto && !self.msCrypto)) {
    throw new Error(
      'Your browser does not have secure random generator. ' +
      'If you don’t need unpredictable IDs, you can use nanoid/non-secure.'
    )
  }
}

var crypto = self.crypto || self.msCrypto

/*
 * This alphabet uses a-z A-Z 0-9 _- symbols.
 * Symbols order was changed for better gzip compression.
 */
var url = 'Uint8ArdomValuesObj012345679BCDEFGHIJKLMNPQRSTWXYZ_cfghkpqvwxyz-'

module.exports = function (size) {
  size = size || 21
  var id = ''
  var bytes = crypto.getRandomValues(new Uint8Array(size))
  while (0 < size--) {
    id += url[bytes[size] & 63]
  }
  return id
}

});
$_mod.def("/makeup-next-id$0.1.1/index", function(require, exports, module, __filename, __dirname) { 'use strict';

var nanoid = require('/nanoid$2.0.3/index.browser'/*'nanoid'*/);

var sequenceMap = {};
var defaultPrefix = 'nid';
var randomPortion = nanoid(3);

module.exports = function (el) {
  var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultPrefix;
  var separator = prefix === '' ? '' : '-'; // join first prefix with random portion to create key

  var key = "".concat(prefix).concat(separator).concat(randomPortion); // initialise key in sequence map if necessary

  sequenceMap[key] = sequenceMap[key] || 0;

  if (!el.id) {
    el.setAttribute('id', "".concat(key, "-").concat(sequenceMap[key]++));
  }

  return el.id;
};

});
$_mod.def("/makeup-exit-emitter$0.2.0/index", function(require, exports, module, __filename, __dirname) { 'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var nextID = require('/makeup-next-id$0.1.1/index'/*'makeup-next-id'*/);

var focusExitEmitters = {}; // requires CustomEvent polyfill for IE9+
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent

function doFocusExit(el, fromElement, toElement) {
  el.dispatchEvent(new CustomEvent('focusExit', {
    detail: {
      fromElement: fromElement,
      toElement: toElement
    },
    bubbles: false // mirror the native mouseleave event

  }));
}

function onDocumentFocusIn(e) {
  var newFocusElement = e.target;
  var targetIsDescendant = this.el.contains(newFocusElement); // if focus has moved to a focusable descendant

  if (targetIsDescendant === true) {
    // set the target as the currently focussed element
    this.currentFocusElement = newFocusElement;
  } else {
    // else focus has not gone to a focusable descendant
    window.removeEventListener('blur', this.onWindowBlurListener);
    document.removeEventListener('focusin', this.onDocumentFocusInListener);
    doFocusExit(this.el, this.currentFocusElement, newFocusElement);
    this.currentFocusElement = null;
  }
}

function onWindowBlur() {
  doFocusExit(this.el, this.currentFocusElement, undefined);
}

function onWidgetFocusIn() {
  // listen for focus moving to anywhere in document
  // note that mouse click on buttons, checkboxes and radios does not trigger focus events in all browsers!
  document.addEventListener('focusin', this.onDocumentFocusInListener); // listen for focus leaving the window

  window.addEventListener('blur', this.onWindowBlurListener);
}

var FocusExitEmitter =
/*#__PURE__*/
function () {
  function FocusExitEmitter(el) {
    _classCallCheck(this, FocusExitEmitter);

    this.el = el;
    this.currentFocusElement = null;
    this.onWidgetFocusInListener = onWidgetFocusIn.bind(this);
    this.onDocumentFocusInListener = onDocumentFocusIn.bind(this);
    this.onWindowBlurListener = onWindowBlur.bind(this);
    this.el.addEventListener('focusin', this.onWidgetFocusInListener);
  }

  _createClass(FocusExitEmitter, [{
    key: "removeEventListeners",
    value: function removeEventListeners() {
      window.removeEventListener('blur', this.onWindowBlurListener);
      document.removeEventListener('focusin', this.onDocumentFocusInListener);
      this.el.removeEventListener('focusin', this.onWidgetFocusInListener);
    }
  }]);

  return FocusExitEmitter;
}();

function addFocusExit(el) {
  var exitEmitter = null;
  nextID(el);

  if (!focusExitEmitters[el.id]) {
    exitEmitter = new FocusExitEmitter(el);
    focusExitEmitters[el.id] = exitEmitter;
  }

  return exitEmitter;
}

function removeFocusExit(el) {
  var exitEmitter = focusExitEmitters[el.id];

  if (exitEmitter) {
    exitEmitter.removeEventListeners();
    delete focusExitEmitters[el.id];
  }
}

module.exports = {
  addFocusExit: addFocusExit,
  removeFocusExit: removeFocusExit
};

});
$_mod.def("/makeup-navigation-emitter$0.3.0/index", function(require, exports, module, __filename, __dirname) { 'use strict'; // requires following polyfills or transforms for IE11
// NodeList.forEach
// CustomEvent

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var KeyEmitter = require('/makeup-key-emitter$0.1.0/index'/*'makeup-key-emitter'*/);

var ExitEmitter = require('/makeup-exit-emitter$0.2.0/index'/*'makeup-exit-emitter'*/);

var dataSetKey = 'data-makeup-index';
var defaultOptions = {
  axis: 'both',
  autoInit: 0,
  autoReset: null,
  wrap: false
};

var itemFilter = function itemFilter(el) {
  return !el.hidden;
};

function clearData(els) {
  els.forEach(function (el) {
    return el.removeAttribute(dataSetKey);
  });
}

function setData(els) {
  els.forEach(function (el, index) {
    return el.setAttribute(dataSetKey, index);
  });
}

function onKeyPrev() {
  if (!this.atStart()) {
    this.index--;
  } else if (this.options.wrap) {
    this.index = this.filteredItems.length - 1;
  }
}

function onKeyNext() {
  if (!this.atEnd()) {
    this.index++;
  } else if (this.options.wrap) {
    this.index = 0;
  }
}

function onClick(e) {
  var element = e.target;
  var indexData = element.dataset.makeupIndex; // traverse widget ancestors until interactive element is found

  while (element !== this._el && !indexData) {
    element = element.parentNode;
    indexData = element.dataset.makeupIndex;
  }

  if (indexData !== undefined) {
    this.index = indexData;
  }
}

function onKeyHome() {
  this.index = 0;
}

function onKeyEnd() {
  this.index = this.filteredItems.length;
}

function onFocusExit() {
  if (this.options.autoReset !== null) {
    this.reset();
  }
}

function onMutation() {
  // clear data-makeup-index on ALL items
  clearData(this.items); // set data-makeup-index only on filtered items (e.g. non-hidden ones)

  setData(this.filteredItems);

  this._el.dispatchEvent(new CustomEvent('navigationModelMutation'));
}

var NavigationModel = function NavigationModel(el, itemSelector, selectedOptions) {
  _classCallCheck(this, NavigationModel);

  this.options = _extends({}, defaultOptions, selectedOptions);
  this._el = el;
  this._itemSelector = itemSelector;
};

var LinearNavigationModel =
/*#__PURE__*/
function (_NavigationModel) {
  _inherits(LinearNavigationModel, _NavigationModel);

  function LinearNavigationModel(el, itemSelector, selectedOptions) {
    var _this;

    _classCallCheck(this, LinearNavigationModel);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(LinearNavigationModel).call(this, el, itemSelector, selectedOptions));

    if (_this.options.autoInit !== null) {
      _this._index = _this.options.autoInit;

      _this._el.dispatchEvent(new CustomEvent('navigationModelInit', {
        detail: {
          items: _this.filteredItems,
          toIndex: _this.options.autoInit
        },
        bubbles: false
      }));
    }

    return _this;
  }

  _createClass(LinearNavigationModel, [{
    key: "reset",
    value: function reset() {
      if (this.options.autoReset !== null) {
        this._index = this.options.autoReset; // do not use index setter, it will trigger change event

        this._el.dispatchEvent(new CustomEvent('navigationModelReset', {
          detail: {
            toIndex: this.options.autoReset
          },
          bubbles: false
        }));
      }
    }
  }, {
    key: "atEnd",
    value: function atEnd() {
      return this.index === this.filteredItems.length - 1;
    }
  }, {
    key: "atStart",
    value: function atStart() {
      return this.index <= 0;
    }
  }, {
    key: "items",
    get: function get() {
      return this._el.querySelectorAll(this._itemSelector);
    }
  }, {
    key: "filteredItems",
    get: function get() {
      return Array.prototype.slice.call(this.items).filter(itemFilter);
    }
  }, {
    key: "index",
    get: function get() {
      return this._index;
    },
    set: function set(newIndex) {
      if (newIndex > -1 && newIndex < this.filteredItems.length && newIndex !== this.index) {
        this._el.dispatchEvent(new CustomEvent('navigationModelChange', {
          detail: {
            fromIndex: this.index,
            toIndex: newIndex
          },
          bubbles: false
        }));

        this._index = newIndex;
      }
    }
  }]);

  return LinearNavigationModel;
}(NavigationModel); // 2D Grid Model will go here

/*
class GridModel extends NavigationModel {
    constructor(el, rowSelector, colSelector) {
        super();
        this._coords = null;
    }
}
*/


var NavigationEmitter =
/*#__PURE__*/
function () {
  function NavigationEmitter(el, model) {
    _classCallCheck(this, NavigationEmitter);

    this.model = model;
    this.el = el;
    this._keyPrevListener = onKeyPrev.bind(model);
    this._keyNextListener = onKeyNext.bind(model);
    this._keyHomeListener = onKeyHome.bind(model);
    this._keyEndListener = onKeyEnd.bind(model);
    this._clickListener = onClick.bind(model);
    this._focusExitListener = onFocusExit.bind(model);
    this._observer = new MutationObserver(onMutation.bind(model));
    setData(model.filteredItems);
    KeyEmitter.addKeyDown(this.el);
    ExitEmitter.addFocusExit(this.el);
    var axis = model.options.axis;

    if (axis === 'both' || axis === 'x') {
      this.el.addEventListener('arrowLeftKeyDown', this._keyPrevListener);
      this.el.addEventListener('arrowRightKeyDown', this._keyNextListener);
    }

    if (axis === 'both' || axis === 'y') {
      this.el.addEventListener('arrowUpKeyDown', this._keyPrevListener);
      this.el.addEventListener('arrowDownKeyDown', this._keyNextListener);
    }

    this.el.addEventListener('homeKeyDown', this._keyHomeListener);
    this.el.addEventListener('endKeyDown', this._keyEndListener);
    this.el.addEventListener('click', this._clickListener);
    this.el.addEventListener('focusExit', this._focusExitListener);

    this._observer.observe(this.el, {
      childList: true,
      subtree: true,
      attributeFilter: ['hidden'],
      attributes: true
    });
  }

  _createClass(NavigationEmitter, [{
    key: "destroy",
    value: function destroy() {
      KeyEmitter.removeKeyDown(this.el);
      ExitEmitter.removeFocusExit(this.el);
      this.el.removeEventListener('arrowLeftKeyDown', this._keyPrevListener);
      this.el.removeEventListener('arrowRightKeyDown', this._keyNextListener);
      this.el.removeEventListener('arrowUpKeyDown', this._keyPrevListener);
      this.el.removeEventListener('arrowDownKeyDown', this._keyNextListener);
      this.el.removeEventListener('homeKeyDown', this._keyHomeListener);
      this.el.removeEventListener('endKeyDown', this._keyEndListener);
      this.el.removeEventListener('click', this._clickListener);
      this.el.removeEventListener('focusExit', this._focusExitListener);

      this._observer.disconnect();
    }
  }], [{
    key: "createLinear",
    value: function createLinear(el, itemSelector, selectedOptions) {
      var model = new LinearNavigationModel(el, itemSelector, selectedOptions);
      return new NavigationEmitter(el, model);
    }
    /*
    static createGrid(el, rowSelector, colSelector, selectedOptions) {
        return null;
    }
    */

  }]);

  return NavigationEmitter;
}();

module.exports = NavigationEmitter;

});
$_mod.installed("makeup-active-descendant$0.2.1", "makeup-next-id", "0.1.1");
$_mod.def("/makeup-active-descendant$0.2.1/index", function(require, exports, module, __filename, __dirname) { 'use strict';

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _get(target, property, receiver) { if (typeof Reflect !== "undefined" && Reflect.get) { _get = Reflect.get; } else { _get = function _get(target, property, receiver) { var base = _superPropBase(target, property); if (!base) return; var desc = Object.getOwnPropertyDescriptor(base, property); if (desc.get) { return desc.get.call(receiver); } return desc.value; }; } return _get(target, property, receiver || target); }

function _superPropBase(object, property) { while (!Object.prototype.hasOwnProperty.call(object, property)) { object = _getPrototypeOf(object); if (object === null) break; } return object; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var NavigationEmitter = require('/makeup-navigation-emitter$0.3.0/index'/*'makeup-navigation-emitter'*/);

var nextID = require('/makeup-next-id$0.1.1/index'/*'makeup-next-id'*/);

var defaultOptions = {
  activeDescendantClassName: 'active-descendant',
  autoInit: -1,
  autoReset: -1,
  axis: 'both'
};

function onModelMutation() {
  var options = this._options;
  var modelIndex = this._navigationEmitter.model.index;
  this.filteredItems.forEach(function (item, index) {
    nextID(item);

    if (index !== modelIndex) {
      item.classList.remove(options.activeDescendantClassName);
    } else {
      item.classList.add(options.activeDescendantClassName);
    }
  });
}

function onModelChange(e) {
  var fromItem = this.filteredItems[e.detail.fromIndex];
  var toItem = this.filteredItems[e.detail.toIndex];

  if (fromItem) {
    fromItem.classList.remove(this._options.activeDescendantClassName);
  }

  if (toItem) {
    toItem.classList.add(this._options.activeDescendantClassName);

    this._focusEl.setAttribute('aria-activedescendant', toItem.id);
  }

  this._el.dispatchEvent(new CustomEvent('activeDescendantChange', {
    detail: {
      fromIndex: e.detail.fromIndex,
      toIndex: e.detail.toIndex
    }
  }));
}

function onModelReset(e) {
  var toIndex = e.detail.toIndex;
  var activeClassName = this._options.activeDescendantClassName;
  this.filteredItems.forEach(function (el) {
    el.classList.remove(activeClassName);
  });

  if (toIndex > -1) {
    var itemEl = this.filteredItems[toIndex];
    itemEl.classList.add(activeClassName);

    this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
  } else {
    this._focusEl.removeAttribute('aria-activedescendant');
  }
}

var ActiveDescendant =
/*#__PURE__*/
function () {
  function ActiveDescendant(el) {
    _classCallCheck(this, ActiveDescendant);

    this._el = el;
    this._onMutationListener = onModelMutation.bind(this);
    this._onChangeListener = onModelChange.bind(this);
    this._onResetListener = onModelReset.bind(this);

    this._el.addEventListener('navigationModelMutation', this._onMutationListener);

    this._el.addEventListener('navigationModelChange', this._onChangeListener);

    this._el.addEventListener('navigationModelReset', this._onResetListener);
  }

  _createClass(ActiveDescendant, [{
    key: "destroy",
    value: function destroy() {
      this._el.removeEventListener('navigationModelMutation', this._onMutationListener);

      this._el.removeEventListener('navigationModelChange', this._onChangeListener);

      this._el.removeEventListener('navigationModelReset', this._onResetListener);
    }
  }]);

  return ActiveDescendant;
}();

var LinearActiveDescendant =
/*#__PURE__*/
function (_ActiveDescendant) {
  _inherits(LinearActiveDescendant, _ActiveDescendant);

  function LinearActiveDescendant(el, focusEl, containerEl, itemSelector, selectedOptions) {
    var _this;

    _classCallCheck(this, LinearActiveDescendant);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(LinearActiveDescendant).call(this, el));
    _this._options = _extends({}, defaultOptions, selectedOptions);
    _this._navigationEmitter = NavigationEmitter.createLinear(el, itemSelector, {
      autoInit: _this._options.autoInit,
      autoReset: _this._options.autoReset,
      axis: _this._options.axis
    });
    _this._focusEl = focusEl;
    _this._containerEl = containerEl;
    _this._itemSelector = itemSelector; // ensure container has an id

    nextID(containerEl); // if DOM hierarchy cannot be determined,
    // focus element must programatically 'own' the container of descendant items

    if (containerEl !== focusEl) {
      focusEl.setAttribute('aria-owns', containerEl.id);
    } // ensure each item has an id


    _this.items.forEach(function (itemEl) {
      nextID(itemEl);
    });

    if (_this._options.autoInit > -1) {
      var itemEl = _this.filteredItems[_this._options.autoInit];
      itemEl.classList.add(_this._options.activeDescendantClassName);

      _this._focusEl.setAttribute('aria-activedescendant', itemEl.id);
    }

    return _this;
  }

  _createClass(LinearActiveDescendant, [{
    key: "reset",
    value: function reset() {
      this._navigationEmitter.model.reset();
    }
  }, {
    key: "destroy",
    value: function destroy() {
      _get(_getPrototypeOf(LinearActiveDescendant.prototype), "destroy", this).call(this);

      this._navigationEmitter.destroy();
    }
  }, {
    key: "index",
    get: function get() {
      return this._navigationEmitter.model.index;
    },
    set: function set(newIndex) {
      this._navigationEmitter.model.index = newIndex;
    }
  }, {
    key: "filteredItems",
    get: function get() {
      return this._navigationEmitter.model.filteredItems;
    }
  }, {
    key: "items",
    get: function get() {
      return this._navigationEmitter.model.items;
    } // backwards compat

  }, {
    key: "_items",
    get: function get() {
      return this.items;
    }
  }, {
    key: "wrap",
    set: function set(newWrap) {
      this._navigationEmitter.model.options.wrap = newWrap;
    }
  }]);

  return LinearActiveDescendant;
}(ActiveDescendant);
/*
class GridActiveDescendant extends ActiveDescendant {
    constructor(el, focusEl, containerEl, rowSelector, cellSelector) {
        super(el);
    }
}
*/


function createLinear(el, focusEl, containerEl, itemSelector, selectedOptions) {
  return new LinearActiveDescendant(el, focusEl, containerEl, itemSelector, selectedOptions);
}

module.exports = {
  createLinear: createLinear
};

});
$_mod.def("/makeup-active-descendant$0.2.1/docs/index", function(require, exports, module, __filename, __dirname) { "use strict";

/* eslint-disable no-console */
var ActiveDescendant = require('/makeup-active-descendant$0.2.1/index'/*'../index.js'*/);

var navs = [];
var appender = document.getElementById('appender');
var widgetEls = document.querySelectorAll('.widget');
var wrapCheckbox = document.getElementById('wrap');
appender.addEventListener('click', function () {
  widgetEls.forEach(function (el) {
    var list = el.querySelector('ul');
    var newListItem = document.createElement('li');
    newListItem.setAttribute('role', 'option');
    var numListItems = parseInt(list.querySelectorAll('li').length, 10);
    newListItem.innerText = "Item ".concat(numListItems);
    list.appendChild(newListItem);
  });
});
widgetEls.forEach(function (el) {
  el.addEventListener('activeDescendantChange', function (e) {
    console.log(e);
  });
  var options = {
    useAriaSelected: false
  };

  if (el.dataset.makeupInit !== undefined) {
    options.autoInit = el.dataset.makeupInit;
  }

  if (el.dataset.makeupReset !== undefined) {
    if (el.dataset.makeupReset === 'null') {
      options.autoReset = null;
    } else {
      options.autoReset = el.dataset.makeupReset;
    }
  }

  var widget = ActiveDescendant.createLinear(el, el.querySelector('input') || el.querySelector('ul'), el.querySelector('ul'), 'li', options);
  navs.push(widget);
});
wrapCheckbox.addEventListener('change', function (e) {
  navs[0].wrap = e.target.checked;
});

});
$_mod.run("/makeup-active-descendant$0.2.1/docs/index");
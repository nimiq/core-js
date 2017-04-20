var path = require('path');
var resolve = require('resolve');

function getPeerDependency (packageName) {
  let version
  let packagePath

  try {
    packagePath = resolve.sync(packageName, {
      basedir: process.cwd(),
      packageFilter: function (pkg) {
        version = pkg.version.replace(/-.*$/, '')
        return pkg
      }
    })
  } catch (err) {

  }

  if (!packagePath) {
    try {
      packagePath = resolve.sync(packageName, {
        paths: require.main.paths,
        packageFilter: function (pkg) {
          version = pkg.version.replace(/-.*$/, '')
          return pkg
        }
      })
    } catch (err) {

    }
  }

  if (packagePath) {
    packagePath = packagePath.replace(/node_modules(?!.*node_modules).*?$/, path.join('node_modules', packageName))
  }

  return { version, path: packagePath }
}

module.exports = getPeerDependency;

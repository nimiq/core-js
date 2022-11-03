#!/bin/bash

set -e

# Check that at least one parameter (type of package to build) has been specified
if [[ -z $1 ]];
then
  echo "Error: must specify if building a deb or rpm package"
  exit 1
fi

NODE_BIN=$(which node)
HOME_PATH=$(dirname "$0")/..

# Make sure we start from the right path
cd ${HOME_PATH}

# Create the directories where all files will be copied
mkdir packaging/BUILD/{fakeroot/etc/nimiq/,modules/,lib/,build/}

# Copy files that need to go verbatim into the package
cp dist/VERSION ${NODE_BIN} packaging/BUILD/
cp -r clients/nodejs/node-ui packaging/BUILD/
cp clients/nodejs/sample.conf packaging/BUILD/fakeroot/etc/nimiq/
cp package.json packaging/BUILD/
cp -r node_modules packaging/BUILD/
cp dist/node.* dist/worker-* dist/web.* packaging/BUILD/lib/
cp build/Release/nimiq_*.node packaging/BUILD/build
mv packaging/BUILD/fakeroot/etc/nimiq/sample.conf packaging/BUILD/fakeroot/etc/nimiq/nimiq.conf

# Copy files that need to be modified from their original form
for i in $(ls clients/nodejs/ | grep 'js$');
  do sed 's|../../dist/node.js|./lib/node.js|' clients/nodejs/${i} > packaging/BUILD/${i}
done

for i in $(ls clients/nodejs/modules/);
  do sed 's|../../../dist/|../lib/|' clients/nodejs/modules/${i} > packaging/BUILD/modules/${i}
done

# Format-specific steps to finally build the binary package
if [ "$1" == "deb" ]
then
  sed 's|node "$SCRIPT_PATH/index.js"|/usr/share/nimiq/app/node "/usr/share/nimiq/app/index.js"|' clients/nodejs/nimiq > packaging/BUILD/nimiq
  cd packaging/BUILD
  ../../node_modules/.bin/node-deb --no-default-package-dependencies -- node *.js VERSION build/ lib/ modules/ node-ui/
  mv *.deb ../../dist/
elif [ "$1" == "rpm" ]
then
  sed 's|node "$SCRIPT_PATH/index.js"|/usr/share/nimiq/node "/usr/share/nimiq/index.js"|' clients/nodejs/nimiq > packaging/BUILD/nimiq
  cd packaging
  rpmbuild -bb SPECS/nimiq.spec
  mv RPMS/x86_64/*.rpm ../dist
fi

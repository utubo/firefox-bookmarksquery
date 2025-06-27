#!/usr/bin/sh

SCRIPT_DIR=$(cd $(dirname $0); pwd)
cd $SCRIPT_DIR/src
zip -r ../bookmarkquery.zip *
cd ..
mv -f bookmarkquery.zip bookmarkquery.xpi


#!/usr/bin/sh

SCRIPT_DIR=$(cd $(dirname $0); pwd)
cd $SCRIPT_DIR/src
zip -r ../bookmarksquery.zip *
cd ..
mv -f bookmarksquery.zip bookmarksquery.xpi


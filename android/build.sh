#!/bin/bash
pushd ..
npx expo prebuild --platform android
popd
./gradlew assembleRelease

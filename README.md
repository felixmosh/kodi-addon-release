# kodi-addon-release
> Bump KODI addon version, update changelog, create tag, commit and release the addon in one step.

## Installation

Install with npm

```shell
npm install -g kodi-addon-release
```

## Usage

```shell
kodi-release
```

By default, this will
* Execute .git/hooks/pre-release (if present)
* Increment the patch version (ex: from 1.2.0 to 1.2.1) in the `addon.xml` file using the [Semantic Versioning specification](http://semver.org/)
* Ask you to update the `changelog.txt`
* Commit the `addon.xml` file
* Create a Git tag for the new version
* Push to the remote server
* Execute .git/hooks/post-release (if present)

Force a specific version

```shell
kodi-release -f 1.3.0-alpha
```

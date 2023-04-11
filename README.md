# package-utilities

### Set ES paths on package.json

```
npx tsc --module ESNext --outDir es && \
npx package-utilities --set-es-paths --include "src/**/*.js" --es-folder es
```

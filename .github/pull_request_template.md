This is a long-lived branch, intended to aggregate all changes planned for version `VERSION`.

Pull requests should be made against this branch. Merges to this branch should be done via a merge commit. When ready, this branch should be merged to main via a squash commit.

## Changelog

```txt
Summary
	1. document grouping follow 'SemVer2.0' protocol
	2. use 'PATCH' as a minimum granularity
	3. use concise descriptions
	4. type: feat \ fix \ update \ perf \ remove \ docs \ chore
	5. version timestamp follow the yyyy.MM.dd format
```

## Deployment Checklist

1. [ ] merge all pull requests to llb
2. [ ] ensure `src/manifest.ts` and `package.json` have the correct version number
3. [ ] use makefile to generate zips (`make chrome`, `make firefox`)
    - [ ] chrome should be tested with `npm run build`
    - [ ] test firefox locally using zip
4. [ ] merge llb to main
5. [ ] upload zips from `3` to chrome webstore and firefox addons

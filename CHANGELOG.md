# CHANGELOG
```txt
Summary
	1. document grouping follow 'SemVer2.0' protocol
	2. use 'PATCH' as a minimum granularity
	3. use concise descriptions
	4. type: feat \ fix \ update \ perf \ remove \ docs \ chore
	5. version timestamp follow the yyyy.MM.dd format
```

# v0.3.1 [2023.06.27]
- feat: overhaul popup menu to have new quickmenu for quick changes and an advanced tab for full options list (#141)
- remove: management permissions requirement in manifest (#155)
- chore: update integration logic to send test message instead of using management api
- feat: block users promoting tweets (#5)

## v0.3.0 [2023.06.26]
- chore: migrate to create-chrome-ext with typescript
- chore: also check profile shape to detect nft avatars (#130)
- feat: use travis brown's verified db to check legacy verifications (#134)
- feat: integration with soupcan (#139)
- fix: queue locking and overly fast blocking (#66)
- fix: critical point logic in queue and counter new generate ref ids per lock
- fix: ignore error responses from twitter (#142)
- perf: change user object in queue to be slimmer

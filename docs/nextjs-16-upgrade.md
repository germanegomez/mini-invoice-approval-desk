# Next.js 16.4.3 upgrade evidence

This document records the dependency and compatibility decision for the migration from the adopted baseline commit `19667a44044ebb0ef039cb0ae02d7eaf07aa2b4f`.

## Dependency decision

| Package | Previous artifact | Selected artifact | Decision |
| --- | --- | --- | --- |
| `next` | `15.5.27`, published 2026-09-30, tag `def7eff9063f79cf58610c15fe58dd78b967c885`, registry integrity `sha512-F82CrlPZ8GRxBH9RIIoR3qU1t5RT3dv1K8moe8SjlDEquiFipvEI13R1Om90TaUOEwShkWCMlg8+gvTNzfMhvg==` | `16.4.3`, published 2026-10-23, tag `29bbeab09981148ade186e8599ecdede15abc281`, registry integrity `sha512-OqxKTGi9u80FydydsMNYNjnuje9Au+kvHlt2GZ//ftdpDHm1dxKqAaENoOOTX5wKzn+9vaKUNIfZeyZUuLhCnA==` | Select the exact non-prerelease release. Next.js 16 is Active LTS; 15 is Maintenance LTS. |
| `eslint-config-next` | `15.5.27`, integrity `sha512-SlpZ5Ch1bM+GNHxahIoCy5OVgbpIHzHoGQDjHo6vEhxvYMukWYVo++AEh9RWYaIxH1i38PO7ArzSdmTruswOew==` | `16.4.3`, integrity `sha512-j9IqBma6abp800frdUURaizYMgXOK+jNGyq6CsYcM9AxpSJs5D/TgMNGeAmRUilZvA7g9V1Tr71gNg9/SVTuMQ==` | Keep the framework lint rules on the same release as Next.js. |
| `react` / `react-dom` | Lockfile resolved `19.3.0` | Keep exact `19.3.0`; integrities `sha512-E8LUcbtBWt20bbl2YoHfx4ZDBdxVTfOKtCZn9cDSJ4l6/nuoApcpIBcj47t2wZoVX8g2ZHuMHbiShgCR1T5Sog==` and `sha512-JDk8dgif51OjFoDE70+OT9ICyYr+69HlmihNwp1+Nsfbna3t5sIiCa9ZJktDmQ4/1b/rn26hIAR2uYXDMr5r0Q==` | Next.js 16.4.3 accepts `^19.0.0`. The codemod proposed 19.3.1, but that unrelated patch was not required, so the tested baseline version is retained. |
| `@types/react` / `@types/react-dom` | Lockfile resolved `19.3.0` | Keep exact `19.3.0`; integrities `sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg==` and `sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q==` | Preserve the already resolved types and enforce one version with pnpm overrides. |
| `eslint` | Lockfile resolved `9.39.5`, published 2026-07-10 and now EOL/deprecated | Keep exact `9.39.5`, integrity `sha512-DgZS62aPLXKlnxILS/AYCoRvHaZeXceIzlXPkkGGzJWSow1aEk0lbTlxUSlyjC8jcaKxAdOnTDz+o1JFSBsyjw==` | ESLint 10.14.0 was evaluated before selection and lint itself passed, but `pnpm peers check` found that the `import`, `jsx-a11y`, and `react` plugins bundled by `eslint-config-next@16.4.3` only declare support through ESLint 9. Retain the compatible baseline version rather than ship unsupported peers; revisit when the framework config updates those plugins. |

Official sources: [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [Next.js support policy](https://nextjs.org/support-policy), [v15.5.27 release](https://github.com/vercel/next.js/releases/tag/v15.5.27), [v16.4.3 release](https://github.com/vercel/next.js/releases/tag/v16.4.3), [Next.js tag comparison](https://github.com/vercel/next.js/compare/v15.5.27...v16.4.3), [ESLint support policy](https://eslint.org/version-support/), and [ESLint v10.14.0 release](https://github.com/eslint/eslint/releases/tag/v10.14.0). Registry integrity and peer/runtime metadata were read from the official npm registry before retaining the dependency changes.

The selected runtime remains Node.js `>=22`, which satisfies Next.js 16's `>=20.9.0` requirement. Local validation covered Node 24.19.0 and the final clean worktree used Node 24.22.0; CI uses the maintained Node 22 line. TypeScript resolves to 5.9.3, above the documented 5.1 minimum. The pnpm version remains the declared `12.14.0`.

The selected dependency graph is fixed by `pnpm-lock.yaml` with SHA-256 `4CFC36FE49570B1E1227180FC4E3B39D48639672AE4AD42F07249AB39730E2EF`. A frozen install resolves `next@16.4.3`, `react@19.3.0`, `react-dom@19.3.0`, `eslint@9.39.5`, and `eslint-config-next@16.4.3`; `pnpm peers check` reports no peer dependency issues.

## Migration review

The exact `@next/codemod@16.4.3` package (registry integrity `sha512-3Rn4IP8pVWW7JOF3tv8V0fF78/a/UaGu+CmgiU82qaIhS4yOdleyLSDSNJINYj/t9A9nwJnSmeWSLU6lh/dOQg==`) ran the recommended version-16 transforms. It found no middleware, unstable APIs, experimental PPR, or partial-prefetch configuration to rewrite. Its optional Cache Components transform added `instant = false`, but the build correctly rejected that route export because this project does not enable `cacheComponents`; manual review removed the incompatible opt-out instead of enabling a new caching model. No API handler, database schema, migration, or seed data changed.

Manual review confirmed:

- dynamic route-handler `params` were already awaited;
- lint already used the ESLint CLI, because `next lint` is removed in version 16; the legacy `FlatCompat` wrapper was replaced with the native flat-config exports required by `eslint-config-next@16.4.3`;
- the stricter React lint rules rejected the former synchronous state update inside the theme toggle's mount effect, so hydration detection now uses `useSyncExternalStore` while keeping the same server placeholder and client toggle behavior;
- there is no custom Webpack/Turbopack configuration, middleware, AMP, runtime config, or `next/legacy/image` usage;
- the only application image is the local SVG icon and no changed image default affects it;
- the project has no parallel route slots requiring new `default` files; and
- the MIT license, package author, visible footer attribution, and copyright notice remain unchanged.

## Verification and rollback

The baseline and candidate are checked with frozen install, lint, typecheck, the existing tests, and a production build. `pnpm smoke` starts the built application only on a disposable loopback port with a deliberately unreachable loopback database URL. It verifies the home page, icon, and controlled error contracts of the invoice and stats APIs without credentials, real data, migrations, seed, or external writes.

Both builds expose the same seven routes (`/`, `/_not-found`, the invoice collection and item/status APIs, the stats API, and `/icon.svg`). The candidate verification passed frozen installation, peer validation, lint, typecheck, all four existing tests, the production build, and the sanitized smoke test. The parent integration repository validator also passed in full. A database-backed success-path smoke was intentionally not run because this ticket does not authorize migrations, seed data, or writes to a persistent service.

Rollback is a normal Git revert to baseline commit `19667a44044ebb0ef039cb0ae02d7eaf07aa2b4f`, which restores both `package.json` and `pnpm-lock.yaml`. No schema or operational rollback is needed because this change performs no migration, seed, image publication, deployment, or production write.

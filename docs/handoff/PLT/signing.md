# Code signing and notarisation — exact steps (PLT-0034–0038)

The build config and CI already sign when the secrets below exist and verify signatures after packaging
(`.github/workflows/build.yml`: `signtool verify /pa /v`, `codesign --verify --deep --strict`, `spctl -a -t exec`,
`stapler validate`); a failing check fails the job, and the Steam upload job only runs after a green build.

## Windows — Azure Trusted Signing (recommended; OV/EV certificate alternative below)

1. Azure portal → create a **Trusted Signing account** (region close to the CI runners), then a
   **certificate profile** of type *Public Trust*. Complete the organisation identity validation (company
   documents; takes 1–10 business days).
2. Create an **App registration** (service principal) `sns-ci-signing`; give it the role
   *Trusted Signing Certificate Profile Signer* on the certificate profile. Create a client secret (max 12 months).
3. GitHub → Settings → Secrets and variables → Actions, add:
   `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TRUSTED_SIGNING_ENDPOINT`
   (e.g. `https://weu.codesigning.azure.net`), `AZURE_CODE_SIGNING_ACCOUNT`, `AZURE_CERT_PROFILE`,
   `AZURE_PUBLISHER_NAME` (exactly the validated organisation name).
4. Run *build* manually; check the Windows job's "Verify Authenticode signatures" step and that
   `SutureAndSteelDemo.exe` → Properties → Digital Signatures shows the organisation with a timestamp.
   electron-builder signs every `.exe`, `.dll` and `.node` it packages, timestamped via RFC 3161
   (`http://timestamp.acs.microsoft.com`).

*Alternative:* an OV/EV certificate on a cloud HSM (DigiCert KeyLocker, SSL.com eSigner). Configure
electron-builder's `win.signtoolOptions.sign` hook with the vendor's CLI; never export a key to a developer machine.

## macOS — Developer ID + notarytool

1. Apple Developer Program (Organization) → Certificates → create **Developer ID Application** certificate
   (CSR from a Mac keychain). Export as `.p12` with a strong password.
2. App Store Connect → Users and Access → Integrations → **App Store Connect API** → create a key with
   *Developer* access; download `AuthKey_XXXX.p8` (only downloadable once). Note Key ID and Issuer ID.
3. GitHub secrets: `MAC_CERT_P12_BASE64` (`base64 -i cert.p12`), `MAC_CERT_PASSWORD`,
   `APPLE_API_KEY_P8_BASE64` (`base64 -i AuthKey_XXXX.p8`), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID`.
4. Securely delete local copies of the `.p12` and `.p8`.
5. Run *build*; the macOS job signs with the hardened runtime and `desktop/build/entitlements.mac.plist`
   (only `allow-jit`), notarises with notarytool, staples, then verifies. `libsteam_api.dylib` and the
   steamworks.js `.node` files inside `app.asar.unpacked` are signed with the same identity (PLT-0036).
6. Gatekeeper test on a clean Mac: install the demo through Steam (`beta` branch), launch — no "unidentified
   developer" or "damaged" prompt; `spctl -a -vv "/…/Suture & Steel Demo.app"` says *accepted, source=Notarized
   Developer ID*.

## Custody, rotation, revocation (PLT-0037)

- Keys live only in GitHub Actions secrets (or the cloud HSM). Access to the repo's secrets: 2 named people.
- Rotation: Azure client secret every 12 months (calendar reminder, 30 days ahead); Apple API key yearly; Developer
  ID certificate before expiry (5 years) — create the new one, update the secret, run a build, then revoke the old one
  only after the new signed build is live.
- Revocation (suspected leak): Azure → revoke the certificate profile / delete the client secret; Apple → revoke the
  Developer ID certificate and API key (notarised builds already shipped remain valid unless Apple revokes the
  ticket); rotate secrets; rebuild and re-upload; post-mortem.

# WealthFlow Testing Document Pack

This pack provides all documents needed to test the onboarding process in both success and failure paths.

## Required Categories in App
For salaried employees, the app requires these categories before submission:
1. Passport / ID
2. Address Proof
3. Tax Residency
4. SoW Declaration
5. Bank Statements (Source of Funds)
6. Employment Contract
7. Payslips

For business owners, the app requires these categories before submission:
1. Passport / ID
2. Address Proof
3. Tax Residency
4. SoW Declaration
5. Bank Statements (Source of Funds)
6. Business Registry Extract
7. Shareholding Structure
8. Company Financial Statements
9. Dividend Statements

## Folder Map
- `success-case/`: complete, consistent salaried-employee data set expected to pass readiness and submit flow.
- `success-case-business-owner/`: complete, consistent business-owner data set expected to pass readiness and submit flow.
- `failure-case-missing-docs/`: one required category intentionally omitted.
- `failure-case-mismatched-data/`: all categories present but key fields conflict.
- `failure-case-weak-evidence/`: all categories present but evidence is vague/insufficient.
- `failure-case-no-extractable-text/`: includes empty/near-empty files to trigger extraction failure behavior.

## Suggested Test Execution
### Salaried Employee Success Case
1. Create a new case in the app with:
   - Client Name: `Alyssa Tan`
   - Nationality: `Singapore`
   - Residence: `Singapore`
   - Occupation: `Salaried Employee - Managing Director`
   - Net Worth: `8500000`
   - Purpose: `Private banking onboarding`
2. Upload each file into the matching category.
3. Run `Run AI Analysis`.
4. Verify readiness score, risk level, mismatch output, and submission behavior.

### Business Owner Success Case
1. Create a new case in the app with:
   - Client Name: `Benjamin Lim Jun Hao`
   - Nationality: `Singapore`
   - Residence: `Singapore`
   - Occupation: `Business Owner - Founder and Executive Chairman`
   - Net Worth: `12400000`
   - Purpose: `Private banking onboarding`
2. Upload each file from `success-case-business-owner/` into the matching category.
3. Run `Run AI Analysis`.
4. Verify readiness score, risk level, mismatch output, and submission behavior.
5. If AI suggests optional business-owner follow-up evidence, upload files `13` through `16` for certified share-sale proceeds, FY2026 audited financial statements, full sanctions/PEP/adverse media screening, and ongoing monitoring plan.

## Expected Outcomes
- Success case: no missing categories, low or manageable risk, submission enabled when readiness reaches 100.
- Business owner success case: ownership, company, dividend, and source-of-funds evidence should be consistent and complete.
- Upload files `10` through `15` when testing AI-recommended supporting evidence for equity compensation, dividends, net worth, source of funds, sanctions/PEP screening, and EDD notes.
- Failure cases: missing-doc/mismatch/risk findings should reduce readiness or block clean handoff.

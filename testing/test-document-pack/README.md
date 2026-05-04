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
- `success-case-high-net-worth-founder/`: complete, consistent high-net-worth founder data set with tens-of-millions net worth and a realistic private banking account purpose.
- `success-case-us-person-fatca/`: complete US-person salaried-employee data set for testing FATCA rule evaluation.
- `success-case-us-person-fatca-usd/`: clean USD high-net-worth US-person success case above the USD 5M private-bank minimum.
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

### High-Net-Worth Founder Success Case
1. Create a new case in the app with:
   - Client Name: `Charlotte Ng Mei Xuan`
   - Nationality: `Singapore`
   - Residence: `Singapore`
   - Occupation: `Business Owner - Co-Founder and Executive Chairperson`
   - Net Worth: `68500000`
   - Purpose: `Private banking relationship for discretionary portfolio management, global custody of listed securities, multi-currency liquidity management, Lombard credit access, and long-term family wealth and succession planning.`
2. Upload each file from `success-case-high-net-worth-founder/` into the matching category.
3. Run `Run AI Analysis`.
4. Verify that the AI recognizes a high-net-worth founder profile, consistent source of wealth, supported source of funds, and no major mismatches.

### US Person FATCA Rule Success Case
1. Create a new case in the app with:
   - Client Name: `Michael Anderson`
   - Nationality: `United States`
   - Residence: `United States`
   - Occupation: `Salaried Employee - Regional Director`
   - Net Worth: `4800000`
   - Purpose: `Private banking onboarding and investment portfolio management`
2. Upload each file from `success-case-us-person-fatca/` into the matching category.
3. In Rule Admin, test a published US-person/FATCA rule against this case.
4. Verify that the rule triggers, requires FATCA documentation, and applies the configured risk/readiness actions.
5. Expected Suggested Actions:
   - Medium / Recommended: Obtain brokerage or portfolio statements covering the last 12 months to verify investment-growth claims. Use `19-12-month-brokerage-portfolio-statements.txt`.
   - Medium / Recommended: Request RSU award and vesting documentation to substantiate the restricted stock unit component of wealth. Use `23-rsu-grant-vesting-documentation.txt`.
   - Medium / Recommended: Collect the most recent US individual tax return (Form 1040) to confirm US taxable income and residency. Use `18-us-tax-return-form-1040-fy2025.txt`.
   - High: Apply enhanced due-diligence procedures appropriate for high-net-worth clients with cross-border employment. Use `15-enhanced-due-diligence-screening.txt`.
6. If AI suggests follow-up evidence, upload:
   - `11-six-month-bank-statements-usd-sgd.txt` for recent USD/SGD bank statements.
   - `12-rsu-vesting-transaction-statements.txt` for prior-employer RSU evidence.
   - `13-detailed-asset-statement-portfolio-report.txt` for the SGD 4.8M net worth substantiation.
   - `14-singapore-tax-residency-clarification.txt` for Singapore tax residency clarification.
   - `15-enhanced-due-diligence-screening.txt` for enhanced due-diligence screening.
   - `16-w9-form.txt` for the W-9 Form rule-required document.
   - `17-fatca-self-certification.txt` for the FATCA Form rule-required document.
   - `18-us-tax-return-form-1040-fy2025.txt` for recent US tax return evidence.
   - `19-12-month-brokerage-portfolio-statements.txt` for 12-month investment portfolio growth evidence.
   - `20-singapore-tax-residency-certificate-iras-notice.txt` for Singapore tax residency / IRAS notice evidence.
   - `21-updated-source-of-wealth-narrative.txt` for the updated SoW narrative after follow-up evidence is received.
   - `22-official-singapore-tax-residency-iras-notice.txt` for official dual-residency confirmation.
   - `23-rsu-grant-vesting-documentation.txt` for RSU grant and vesting substantiation.
   - `24-net-worth-currency-reconciliation.txt` for SGD/USD net-worth reconciliation.
   - `25-fatca-crs-periodic-review-plan.txt` for FATCA/CRS periodic review planning.

### US Person FATCA USD Success Case
1. Create a new case in the app with:
   - Client Name: `Daniel Whitmore`
   - Nationality: `United States`
   - Residence: `New York, United States`
   - Occupation: `Managing Director - Technology Investments`
   - Net Worth Currency: `USD`
   - Net Worth: `8500000`
   - Purpose: `To establish a private banking relationship for discretionary portfolio management, custody of listed securities, USD cash management, access to diversified investment products, and long-term wealth planning while maintaining FATCA-compliant reporting as a US person.`
2. Upload each required file from `success-case-us-person-fatca-usd/`.
3. Run `Run AI Analysis`.
4. Verify that the case reaches Ready for Review with 9/9 required documents and FATCA rule-required documents satisfied.

## Expected Outcomes
- Success case: no missing categories, low or manageable risk, submission enabled when readiness reaches 100.
- Business owner success case: ownership, company, dividend, and source-of-funds evidence should be consistent and complete.
- High-net-worth founder success case: tens-of-millions net worth should be supported by audited company financials, shareholding, dividends, share-sale proceeds, bank statements, and investment portfolio evidence.
- Upload files `10` through `15` when testing AI-recommended supporting evidence for equity compensation, dividends, net worth, source of funds, sanctions/PEP screening, and EDD notes.
- Failure cases: missing-doc/mismatch/risk findings should reduce readiness or block clean handoff.

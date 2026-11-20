Adventure Party expense records

The GitHub repository is public. Actual ledger entries, receipts, and summaries in this folder are Git-ignored. Never force-add or publish financial records. Keep a separate private backup: Git will not back them up.

ledger.json is the running source of truth. Add only confirmed transactions supplied by James or supported by a receipt. Never infer a purchase from discussion, installation, trials, or an advertised price. CC5 purchase is not yet confirmed.

For each transaction record: id, paid_date (YYYY-MM-DD), vendor, item, category, business_purpose, currency, subtotal, sales_tax, total_paid, business_use_percent, receipt_path, status, notes. Unknown values stay null. Record refunds as separate negative transactions linked to the original id. Keep currencies separate in totals. Do not label an expense tax-deductible without review.

Store receipts as receipts/YYYY-MM-DD_vendor_item.ext. Avoid payment-card or account details in filenames and notes.

When James reports another expense, update ledger.json and totals.json together, preserving prior entries. Ask only for missing purchase facts. These are recordkeeping totals, not a determination of tax treatment.

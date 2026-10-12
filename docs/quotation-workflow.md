# Sales Quotation workflow

- Sales can create quotations only for active corporate Accounts assigned to their Sales identity and active PICs assigned to those Accounts. Personal Accounts are excluded.
- Sales enters the quotation code manually (required, unique, maximum 30 characters). Codes may also be edited. Existing and soft-deleted codes remain reserved. Internal database IDs remain UUIDs; no sequence is used to assign quotation codes.
- Saving creates and sends a PDF immediately. Failed records remain available for retry. Every successful initial send or resend sets `WAITING`, since the newest emailed version is awaiting the PIC's response. Sales can change a successfully sent quotation to `APPROVED`, `CANCELLED`, or `REVISION`. After editing and resending a revision, it returns to `WAITING` until the PIC responds.
- Editing saves the changes and sends a new PDF version. Deletes are soft deletes; sent-document rows and audit events remain.
- Each emailed PDF is uploaded as an authenticated Cloudinary asset, under the immutable quotation UUID and version rather than an editable code. Older assets remain accessible using their stored public IDs. Cloudinary credentials are read only from server environment variables. The document history stores the asset and recipient metadata.
- Schedule is rendered as `TBA`. Course duration is derived from the course duration in minutes, rounded up to eight-hour training days.
- VAT is 11% for Public/Online and 12% for Private/Inhouse.

Bank details are shared by all types through `BANK_TRANSFER_DETAILS` in `src/modules/quotations/quotation-document.ts`. Configure `MAIL_*` and all three `CLOUDINARY_*` variables in the internal API environment as well.

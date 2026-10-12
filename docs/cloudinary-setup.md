# Cloudinary credentials for quotation PDFs

The Internal API is the only service that should receive Cloudinary credentials.
Do not put `CLOUDINARY_API_SECRET` in the frontend, gateway, source code, or a
committed environment file.

1. In the Cloudinary Console, open the account dashboard and copy the Cloud
   name, API key, and API secret.
2. Put the values in `app/be/internal-api/.env` (not in `.env.example`):

   ```dotenv
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. Restart the `internal-api` service after setting the values.

The environment parser accepts all three values together or none. A partial
configuration causes the Internal API to fail fast instead of silently using
incomplete credentials. The `.env.example` file contains empty placeholders;
never replace them with real credentials before committing.

This prepares credential loading only. Uploading generated quotation PDFs,
private delivery/access, and cleanup policies still need implementation before
Cloudinary is used to store business documents.

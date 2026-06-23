# Website Templates Upload API

## Superadmin Template Upload

Superadmins can now upload pre-built website templates as zip files, which are automatically extracted and registered in the system.

### Endpoint

```
POST /api/admin/templates/upload
```

### Authentication

Requires superadmin/admin authentication token.

### Request Format

**Multipart Form Data:**

```
- zip (file) - The template zip file
- name (string) - Template identifier (slug format, e.g., "modern", "professional")
- displayName (string) - Human-readable template name
- description (string, optional) - Template description
- version (string, optional) - Semantic version (default: "1.0.0")
```

### Zip File Structure

Your zip file should contain a single folder with the template name, containing all template files:

```
my-template.zip
└── my-template/
    ├── index.html           # Main template entry
    ├── package.json         # Template dependencies (optional)
    ├── components/          # React/Vue components
    │   ├── Header.tsx
    │   ├── Footer.tsx
    │   ├── Hero.tsx
    │   └── ...
    ├── styles/              # CSS/Tailwind styles
    │   ├── globals.css
    │   └── ...
    ├── assets/              # Images, icons, fonts
    │   ├── logo.png
    │   ├── favicon.ico
    │   └── ...
    ├── public/              # Static files (optional)
    │   └── ...
    └── config.json          # Template metadata (optional)
```

**Important:** The folder inside the zip must match the `name` parameter exactly.

### cURL Example

```bash
curl -X POST http://localhost:3000/api/admin/templates/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "zip=@modern-template.zip" \
  -F "name=modern" \
  -F "displayName=Modern Design Template" \
  -F "description=Clean, modern design with dark mode support" \
  -F "version=1.0.0"
```

### JavaScript/Fetch Example

```javascript
const formData = new FormData();
formData.append('zip', zipFile); // File object from <input type="file" />
formData.append('name', 'modern');
formData.append('displayName', 'Modern Design Template');
formData.append('description', 'Clean, modern design with dark mode support');
formData.append('version', '1.0.0');

const response = await fetch('/api/admin/templates/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
  },
  body: formData,
});

const result = await response.json();
console.log(result);
```

### Response

**Success (201):**
```json
{
  "success": true,
  "template": {
    "id": "uuid-here",
    "name": "modern",
    "display_name": "Modern Design Template",
    "description": "Clean, modern design with dark mode support",
    "version": "1.0.0",
    "template_path": "templates/modern",
    "preview_image_url": null,
    "is_active": true,
    "created_at": "2026-06-22T12:00:00Z",
    "updated_at": "2026-06-22T12:00:00Z"
  },
  "message": "Template 'Modern Design Template' uploaded and extracted successfully",
  "extractedTo": "/path/to/templates/modern"
}
```

**Error (400 - Invalid zip structure):**
```json
{
  "error": "Template structure invalid. Expected a 'modern' folder in the zip file."
}
```

**Error (400 - Missing fields):**
```json
{
  "error": "Missing required fields: name, displayName"
}
```

**Error (413 - File too large):**
```json
{
  "error": "File too large (max 50MB)"
}
```

### Behavior

1. **File Extraction** - Zip is extracted to `artifacts/api-server/templates/[name]/`
2. **Existing Templates** - If a template with the same `name` exists:
   - Files are replaced with new ones
   - Database record is updated with new metadata
3. **Activation** - Uploaded templates are automatically `is_active = true`
4. **Path** - Template path is automatically set to `templates/[name]`

### Updating a Template

To update an existing template's files, simply upload the zip again with the same `name`. The old files will be replaced and the database record will be updated.

### File Size Limits

- Maximum zip file size: **50MB**
- Adjust in `zipUpload` multer configuration in `routes/website-templates.ts` if needed

### File Format Requirements

- **Format:** ZIP (application/zip)
- **Encoding:** Standard zip, no special compression
- **Case Sensitivity:** Template folder name must match the `name` parameter exactly

## Full API Reference

### Template Management Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/templates` | None | List active templates |
| GET | `/api/templates/:id` | None | Get template details |
| POST | `/api/admin/templates` | Admin | Create template (manual) |
| POST | `/api/admin/templates/upload` | Admin | **Upload template zip** |
| PATCH | `/api/admin/templates/:id` | Admin | Update template metadata |
| DELETE | `/api/admin/templates/:id` | Admin | Delete template |

### Website Management Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/website` | Tenant | Get tenant's website |
| POST | `/api/website` | Tenant | Create website |
| PATCH | `/api/website` | Tenant | Update website |
| POST | `/api/website/switch-template` | Tenant | Switch template |
| POST | `/api/website/publish` | Tenant | Publish website |
| POST | `/api/website/unpublish` | Tenant | Unpublish website |

### Page Management Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/website/pages` | Tenant | List pages |
| GET | `/api/website/pages/:slug` | Tenant | Get page by slug |
| POST | `/api/website/pages` | Tenant | Create page |
| PATCH | `/api/website/pages/:id` | Tenant | Update page |
| DELETE | `/api/website/pages/:id` | Tenant | Delete page |
| PUT | `/api/website/pages/reorder` | Tenant | Reorder pages |

<?php defined( 'ABSPATH' ) || exit; ?>
<div class="wrap">
<h1>Nova Coast Media — CSV Bulk Import</h1>
<?php if ( ! empty( $_GET['ncm_notice'] ) ) : $type = esc_attr( $_GET['ncm_notice_type'] ?? 'success' ); ?>
  <div class="notice notice-<?php echo $type; ?> is-dismissible"><p><?php echo esc_html( urldecode( $_GET['ncm_notice'] ) ); ?></p></div>
<?php endif; ?>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1100px;">
<div>
<h2>Upload CSV</h2>
<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
<?php wp_nonce_field( 'ncm_csv_import' ); ?>
<input type="hidden" name="action" value="ncm_import_csv">
<table class="form-table"><tr><th>CSV File</th><td><input type="file" name="csv_file" accept=".csv" required></td></tr></table>
<?php submit_button( 'Import CSV', 'primary', 'submit', false ); ?>
</form>
</div>
<div>
<h2>CSV Format</h2>
<pre style="background:#f1f1f1;padding:12px;font-size:12px;overflow:auto;border-radius:4px;">title,slug,media_type,location,sub_location,orientation,tags,thumbnail_url,preview_url,full_res_url</pre>
<p><strong>Example row:</strong></p>
<pre style="background:#f1f1f1;padding:12px;font-size:12px;overflow:auto;border-radius:4px;">La Jolla Sunset Aerial,la-jolla-sunset-aerial,video,San Diego,La Jolla,horizontal,"sunset,aerial",thumbnails/lj-sunset.jpg,previews/lj-sunset.mp4,full/lj-sunset-4k.mp4</pre>
<ul style="list-style:disc;padding-left:20px;font-size:13px;">
<li><strong>*_url fields</strong> = R2 object keys, not full URLs</li>
<li><strong>media_type</strong> = photo or video</li>
<li><strong>orientation</strong> = horizontal or vertical</li>
<li><strong>location</strong> = must match taxonomy name exactly</li>
<li><strong>tags</strong> = comma-separated, wrap in quotes</li>
</ul>
</div>
</div>
</div>

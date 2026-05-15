<?php defined( 'ABSPATH' ) || exit; ?>
<div class="wrap">
<h1>Nova Coast Media — Settings</h1>

<form method="post" action="options.php">
<?php settings_fields( 'ncm_r2_group' ); $r2 = get_option( 'ncm_r2_settings', [] ); ?>
<h2>Cloudflare R2</h2>
<table class="form-table">
  <tr><th>Account ID</th><td><input type="text" name="ncm_r2_settings[account_id]" value="<?php echo esc_attr( $r2['account_id'] ?? '' ); ?>" class="regular-text"></td></tr>
  <tr><th>Access Key ID</th><td><input type="text" name="ncm_r2_settings[access_key]" value="<?php echo esc_attr( $r2['access_key'] ?? '' ); ?>" class="regular-text"></td></tr>
  <tr><th>Secret Access Key</th><td><input type="password" name="ncm_r2_settings[secret_key]" value="<?php echo esc_attr( $r2['secret_key'] ?? '' ); ?>" class="regular-text" autocomplete="new-password"></td></tr>
  <tr><th>Bucket Name</th><td><input type="text" name="ncm_r2_settings[bucket]" value="<?php echo esc_attr( $r2['bucket'] ?? '' ); ?>" class="regular-text"></td></tr>
  <tr><th>Public Domain (optional)</th><td><input type="url" name="ncm_r2_settings[public_domain]" value="<?php echo esc_attr( $r2['public_domain'] ?? '' ); ?>" class="regular-text" placeholder="https://media.novacoastmedia.com"><p class="description">Custom domain for public thumbnails. Leave blank to use signed URLs for everything.</p></td></tr>
</table>
<?php submit_button( 'Save R2 Settings' ); ?>
</form>

<hr>

<form method="post" action="options.php">
<?php settings_fields( 'ncm_stripe_group' ); $s = get_option( 'ncm_stripe_settings', [] ); ?>
<h2>Stripe</h2>
<p>Use <strong>live keys</strong> in production. Get your keys from the <a href="https://dashboard.stripe.com/apikeys" target="_blank">Stripe Dashboard</a>.</p>
<table class="form-table">
  <tr><th>Secret Key</th><td><input type="password" name="ncm_stripe_settings[secret_key]" value="<?php echo esc_attr( $s['secret_key'] ?? '' ); ?>" class="regular-text" autocomplete="new-password" placeholder="sk_live_…"></td></tr>
  <tr><th>Publishable Key</th><td><input type="text" name="ncm_stripe_settings[publishable_key]" value="<?php echo esc_attr( $s['publishable_key'] ?? '' ); ?>" class="regular-text" placeholder="pk_live_…"></td></tr>
  <tr><th>Webhook Secret</th><td>
    <input type="password" name="ncm_stripe_settings[webhook_secret]" value="<?php echo esc_attr( $s['webhook_secret'] ?? '' ); ?>" class="regular-text" autocomplete="new-password" placeholder="whsec_…">
    <p class="description">Add this webhook URL in Stripe: <code><?php echo esc_html( rest_url( 'ncm/v1/stripe-webhook' ) ); ?></code></p>
    <p class="description">Events to subscribe: <code>customer.subscription.created</code> <code>customer.subscription.updated</code> <code>customer.subscription.deleted</code> <code>invoice.payment_succeeded</code> <code>invoice.payment_failed</code></p>
  </td></tr>
</table>

<h3>Plan → Stripe Price ID Mapping</h3>
<p>Create recurring prices in Stripe, then paste the <strong>Price ID</strong> (starts with <code>price_</code>) for each plan.</p>
<table class="form-table">
  <tr><th>Starter — 5 downloads/mo</th><td><input type="text" name="ncm_stripe_settings[starter_price_id]" value="<?php echo esc_attr( $s['starter_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
  <tr><th>Growth — 10 downloads/mo</th><td><input type="text" name="ncm_stripe_settings[growth_price_id]" value="<?php echo esc_attr( $s['growth_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
  <tr><th>Pro — 15 downloads/mo</th><td><input type="text" name="ncm_stripe_settings[pro_price_id]" value="<?php echo esc_attr( $s['pro_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
  <tr><th>Unlimited</th><td><input type="text" name="ncm_stripe_settings[unlimited_price_id]" value="<?php echo esc_attr( $s['unlimited_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
</table>
<?php submit_button( 'Save Stripe Settings' ); ?>
</form>

<hr>
<h2>Status</h2>
<?php
$r2_ok     = NCM_R2_Storage::instance()->is_configured();
$stripe_ok = NCM_Stripe_Handler::instance()->is_configured();
echo $r2_ok     ? '<p style="color:green;">&#10003; R2 configured</p>'     : '<p style="color:red;">&#10007; R2 not configured</p>';
echo $stripe_ok ? '<p style="color:green;">&#10003; Stripe configured</p>' : '<p style="color:red;">&#10007; Stripe not configured</p>';
?>
</div>

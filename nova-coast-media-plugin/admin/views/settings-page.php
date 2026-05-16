<?php defined( 'ABSPATH' ) || exit; ?>
<div class="wrap">
<h1>Nova Coast Media - Settings</h1>

<form method="post" action="options.php">
<?php settings_fields( 'ncm_r2_group' ); $r2 = get_option( 'ncm_r2_settings', [] ); ?>
<h2>Cloudflare R2 Storage</h2>
<p>Your photos and videos are stored here. Get credentials from <a href="https://dash.cloudflare.com" target="_blank">Cloudflare Dashboard > R2</a>.</p>
<table class="form-table">
  <tr><th>Account ID</th><td><input type="text" name="ncm_r2_settings[account_id]" value="<?php echo esc_attr( $r2['account_id'] ?? '' ); ?>" class="regular-text" placeholder="abc123..."></td></tr>
  <tr><th>Access Key ID</th><td><input type="text" name="ncm_r2_settings[access_key]" value="<?php echo esc_attr( $r2['access_key'] ?? '' ); ?>" class="regular-text"></td></tr>
  <tr><th>Secret Access Key</th><td><input type="password" name="ncm_r2_settings[secret_key]" value="<?php echo esc_attr( $r2['secret_key'] ?? '' ); ?>" class="regular-text" autocomplete="new-password"></td></tr>
  <tr><th>Bucket Name</th><td><input type="text" name="ncm_r2_settings[bucket]" value="<?php echo esc_attr( $r2['bucket'] ?? '' ); ?>" class="regular-text" placeholder="nova-coast-media"></td></tr>
  <tr><th>Public Domain (optional)</th><td>
    <input type="url" name="ncm_r2_settings[public_domain]" value="<?php echo esc_attr( $r2['public_domain'] ?? '' ); ?>" class="regular-text" placeholder="https://media.novacoastmedia.com">
    <p class="description">If you set up a custom domain for your R2 bucket, enter it here. Otherwise leave blank.</p>
  </td></tr>
</table>
<?php submit_button( 'Save R2 Settings' ); ?>
</form>

<hr>

<form method="post" action="options.php">
<?php settings_fields( 'ncm_stripe_group' ); $s = get_option( 'ncm_stripe_settings', [] ); ?>
<h2>Stripe Payments</h2>
<p>Get your keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank">Stripe Dashboard > Developers > API Keys</a>.</p>
<table class="form-table">
  <tr><th>Secret Key</th><td><input type="password" name="ncm_stripe_settings[secret_key]" value="<?php echo esc_attr( $s['secret_key'] ?? '' ); ?>" class="regular-text" autocomplete="new-password" placeholder="sk_live_..."></td></tr>
  <tr><th>Publishable Key</th><td><input type="text" name="ncm_stripe_settings[publishable_key]" value="<?php echo esc_attr( $s['publishable_key'] ?? '' ); ?>" class="regular-text" placeholder="pk_live_..."></td></tr>
  <tr><th>Webhook Secret</th><td>
    <input type="password" name="ncm_stripe_settings[webhook_secret]" value="<?php echo esc_attr( $s['webhook_secret'] ?? '' ); ?>" class="regular-text" autocomplete="new-password" placeholder="whsec_...">
    <p class="description"><strong>Your webhook URL to paste into Stripe:</strong><br>
    <code><?php echo esc_html( rest_url( 'ncm/v1/stripe-webhook' ) ); ?></code></p>
    <p class="description">In Stripe: Developers > Webhooks > Add endpoint. Enable these events:<br>
    <code>customer.subscription.created</code> | <code>customer.subscription.updated</code> | <code>customer.subscription.deleted</code> | <code>invoice.payment_succeeded</code> | <code>invoice.payment_failed</code></p>
  </td></tr>
</table>

<h3>Plan Price IDs</h3>
<p>Create 4 recurring products in Stripe. Paste the <strong>Price ID</strong> (starts with <code>price_</code>) for each one.</p>
<table class="form-table">
  <tr><th>Starter - 5 downloads/month</th><td><input type="text" name="ncm_stripe_settings[starter_price_id]" value="<?php echo esc_attr( $s['starter_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
  <tr><th>Growth - 10 downloads/month</th><td><input type="text" name="ncm_stripe_settings[growth_price_id]" value="<?php echo esc_attr( $s['growth_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
  <tr><th>Pro - 15 downloads/month</th><td><input type="text" name="ncm_stripe_settings[pro_price_id]" value="<?php echo esc_attr( $s['pro_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
  <tr><th>Unlimited - Unlimited downloads</th><td><input type="text" name="ncm_stripe_settings[unlimited_price_id]" value="<?php echo esc_attr( $s['unlimited_price_id'] ?? '' ); ?>" class="regular-text" placeholder="price_xxx"></td></tr>
</table>
<?php submit_button( 'Save Stripe Settings' ); ?>
</form>

<hr>
<h2>Connection Status</h2>
<?php
$r2_ok     = NCM_R2_Storage::instance()->is_configured();
$stripe_ok = NCM_Stripe_Handler::instance()->is_configured();
echo $r2_ok     ? '<p style="color:green;font-weight:600;">&#10003; R2 configured</p>'     : '<p style="color:red;">&#10007; R2 not configured - fill in all 4 R2 fields above</p>';
echo $stripe_ok ? '<p style="color:green;font-weight:600;">&#10003; Stripe configured</p>' : '<p style="color:red;">&#10007; Stripe not configured - add your secret key above</p>';
?>
</div>
<?php
defined( 'ABSPATH' ) || exit;

/**
 * Cloudflare R2 — AWS Signature V4 signed URLs. No external SDK needed.
 */
class NCM_R2_Storage {
    private static ?self $instance = null;
    private string $account_id;
    private string $access_key;
    private string $secret_key;
    private string $bucket;
    private string $region = 'auto';

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    private function __construct() {
        $o = get_option( 'ncm_r2_settings', [] );
        $this->account_id = $o['account_id'] ?? '';
        $this->access_key = $o['access_key'] ?? '';
        $this->secret_key = $o['secret_key'] ?? '';
        $this->bucket     = $o['bucket']     ?? '';
    }

    public function generate_signed_url( string $key, int $expiry = 300 ) {
        if ( ! $this->is_configured() ) return false;
        $key         = ltrim( $key, '/' );
        $now         = time();
        $date_iso    = gmdate( 'Ymd\THis\Z', $now );
        $date_short  = gmdate( 'Ymd', $now );
        $scope       = "{$date_short}/{$this->region}/s3/aws4_request";
        $credential  = "{$this->access_key}/{$scope}";
        $host        = "{$this->account_id}.r2.cloudflarestorage.com";
        $path        = "/{$this->bucket}/{$key}";
        $params      = [
            'X-Amz-Algorithm'     => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential'    => $credential,
            'X-Amz-Date'          => $date_iso,
            'X-Amz-Expires'       => (string) $expiry,
            'X-Amz-SignedHeaders' => 'host',
        ];
        ksort( $params );
        $query     = http_build_query( $params, '', '&', PHP_QUERY_RFC3986 );
        $canon     = implode( "\n", [ 'GET', $path, $query, "host:{$host}\n", 'host', 'UNSIGNED-PAYLOAD' ] );
        $sts       = implode( "\n", [ 'AWS4-HMAC-SHA256', $date_iso, $scope, hash( 'sha256', $canon ) ] );
        $sk        = $this->signing_key( $date_short );
        $sig       = hash_hmac( 'sha256', $sts, $sk );
        return "https://{$host}{$path}?{$query}&X-Amz-Signature={$sig}";
    }

    public function get_public_url( string $key ): string {
        $o = get_option( 'ncm_r2_settings', [] );
        $d = $o['public_domain'] ?? '';
        if ( $d ) return rtrim( $d, '/' ) . '/' . ltrim( $key, '/' );
        return (string) ( $this->generate_signed_url( $key, 86400 ) ?: '' );
    }

    private function signing_key( string $date ): string {
        $k = hash_hmac( 'sha256', $date,        'AWS4' . $this->secret_key, true );
        $k = hash_hmac( 'sha256', $this->region, $k, true );
        $k = hash_hmac( 'sha256', 's3',          $k, true );
        return hash_hmac( 'sha256', 'aws4_request', $k, true );
    }

    public function is_configured(): bool {
        return $this->account_id && $this->access_key && $this->secret_key && $this->bucket;
    }
}

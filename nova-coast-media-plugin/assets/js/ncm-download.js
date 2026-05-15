/**
 * NCM Download Handler
 * Step-by-step what this does:
 * 1. User clicks .ncm-download-btn
 * 2. AJAX sent to WordPress with asset_id + security nonce
 * 3. PHP validates login + subscription + credits
 * 4. PHP generates a 5-minute signed R2 URL and returns it
 * 5. JS creates an invisible <a download> link and clicks it
 * 6. File downloads directly from Cloudflare R2
 */
( function ( $ ) {
    'use strict';

    const NCMDownload = {

        init() {
            $( document ).on( 'click', '.ncm-download-btn', this.onClick.bind( this ) );
            this.refreshUI();
        },

        onClick( e ) {
            e.preventDefault();
            const $btn    = $( e.currentTarget );
            const assetId = $btn.data( 'asset-id' );

            // Not logged in — show login modal immediately, no AJAX needed
            if ( ! NCM.is_logged_in ) {
                this.showModal( 'login' );
                return;
            }

            if ( $btn.hasClass( 'ncm-loading' ) ) return;
            this.requestDownload( $btn, assetId );
        },

        requestDownload( $btn, assetId ) {
            $btn.addClass( 'ncm-loading' ).text( 'Preparing download…' );

            $.ajax( {
                url:    NCM.ajax_url,
                method: 'POST',
                data: {
                    action:   'ncm_request_download',
                    nonce:    NCM.nonce,
                    asset_id: assetId,
                },
            } )
            .done( ( res ) => {
                if ( res.success ) {
                    this.triggerDownload( res.data.download_url, res.data.filename );
                    this.showToast(
                        res.data.plan === 'unlimited'
                            ? 'Downloaded successfully!'
                            : `Downloaded! ${ res.data.credits_remaining } download${ res.data.credits_remaining !== 1 ? 's' : '' } remaining this month.`,
                        'success'
                    );
                    this.setBtnState( $btn, 'success' );
                    // Update credit displays on page
                    $( '.ncm-credits-display' ).text( res.data.plan === 'unlimited' ? 'Unlimited' : `${ res.data.credits_remaining } downloads left` );
                } else {
                    this.handleError( res.data, $btn );
                }
            } )
            .fail( () => {
                this.showToast( 'Connection error. Please try again.', 'error' );
                this.setBtnState( $btn, 'idle' );
            } );
        },

        triggerDownload( url, filename ) {
            const a      = document.createElement( 'a' );
            a.href       = url;
            a.download   = filename || 'nova-coast-media';
            a.style.display = 'none';
            document.body.appendChild( a );
            a.click();
            setTimeout( () => document.body.removeChild( a ), 200 );
        },

        handleError( data, $btn ) {
            this.setBtnState( $btn, 'idle' );
            switch ( data.code ) {
                case 'not_logged_in':
                    this.showModal( 'login' );
                    break;
                case 'no_subscription':
                    this.showModal( 'upgrade', {
                        title:   'Subscription Required',
                        message: 'Subscribe to access full-resolution San Diego real estate media.',
                        cta:     'View Plans',
                        url:     data.upgrade_url || NCM.upgrade_url,
                    } );
                    break;
                case 'no_credits':
                    this.showModal( 'upgrade', {
                        title:   'Monthly Limit Reached',
                        message: 'You\'ve used all your downloads for this month. Upgrade for more.',
                        cta:     'Upgrade Plan',
                        url:     data.upgrade_url || NCM.upgrade_url,
                    } );
                    break;
                default:
                    this.showToast( data.message || 'Download failed. Please try again.', 'error' );
            }
        },

        // Fetch user status on page load to update button text/credits display
        refreshUI() {
            if ( ! NCM.is_logged_in ) {
                $( '.ncm-credits-display' ).text( '' );
                return;
            }
            $.ajax( { url: NCM.ajax_url, method: 'POST', data: { action: 'ncm_get_user_status', nonce: NCM.nonce } } )
            .done( ( res ) => {
                if ( ! res.success || ! res.data.logged_in ) return;
                const d = res.data;
                const label = d.is_unlimited ? 'Unlimited downloads' : `${ d.credits_remaining } downloads left this month`;
                $( '.ncm-credits-display' ).text( label );
                if ( ! d.has_subscription ) {
                    $( '.ncm-download-btn' ).text( 'Subscribe to Download' ).addClass( 'ncm-locked' );
                } else if ( ! d.is_unlimited && parseInt( d.credits_remaining ) <= 0 ) {
                    $( '.ncm-download-btn' ).text( 'Upgrade to Download More' ).addClass( 'ncm-locked' );
                }
            } );
        },

        setBtnState( $btn, state ) {
            $btn.removeClass( 'ncm-loading ncm-success' );
            const orig = $btn.data( 'original-text' ) || 'Download';
            if ( state === 'success' ) {
                $btn.addClass( 'ncm-success' ).text( 'Downloaded ✓' );
                setTimeout( () => $btn.text( orig ), 3500 );
            } else {
                $btn.text( orig );
            }
        },

        showToast( message, type = 'info' ) {
            const $t = $( `<div class="ncm-toast ncm-toast--${ type }">${ message }</div>` );
            $( 'body' ).append( $t );
            setTimeout( () => $t.addClass( 'ncm-toast--visible' ), 30 );
            setTimeout( () => { $t.removeClass( 'ncm-toast--visible' ); setTimeout( () => $t.remove(), 400 ); }, 4500 );
        },

        showModal( type, opts = {} ) {
            $( '#ncm-modal-overlay' ).remove();
            let content = '';
            if ( type === 'login' ) {
                content = `
                    <h3>Sign In to Download</h3>
                    <p>Create a free account or sign in to access premium San Diego real estate media.</p>
                    <a href="${ NCM.login_url }" class="ncm-btn ncm-btn--primary">Sign In</a>
                    <a href="${ NCM.login_url }&action=register" class="ncm-btn ncm-btn--secondary">Create Account</a>`;
            } else {
                content = `
                    <h3>${ opts.title || 'Upgrade Required' }</h3>
                    <p>${ opts.message || '' }</p>
                    <a href="${ opts.url }" class="ncm-btn ncm-btn--primary">${ opts.cta || 'View Plans' }</a>`;
            }
            const $ov = $( `<div id="ncm-modal-overlay" class="ncm-modal-overlay"><div class="ncm-modal"><button class="ncm-modal-close">&#x2715;</button>${ content }</div></div>` );
            $( 'body' ).append( $ov );
            setTimeout( () => $ov.addClass( 'ncm-modal-overlay--visible' ), 30 );
            $ov.on( 'click', '.ncm-modal-close', () => {
                $ov.removeClass( 'ncm-modal-overlay--visible' );
                setTimeout( () => $ov.remove(), 300 );
            } );
        },
    };

    $( () => NCMDownload.init() );

} )( jQuery );


/* ── Stripe Checkout (plan purchase buttons) ─────────────────────────────── */
( function ( $ ) {
    'use strict';

    $( document ).on( 'click', '.ncm-checkout-btn', function () {
        const $btn = $( this );
        const plan  = $btn.data( 'plan' );
        if ( ! plan || $btn.hasClass( 'ncm-loading' ) ) return;

        $btn.addClass( 'ncm-loading' ).text( 'Redirecting to checkout…' );

        $.ajax( {
            url:    NCM.ajax_url,
            method: 'POST',
            data: {
                action: 'ncm_create_checkout',
                nonce:  NCM.stripe_nonce,
                plan:   plan,
            },
        } )
        .done( ( res ) => {
            if ( res.success && res.data.checkout_url ) {
                window.location.href = res.data.checkout_url;
            } else {
                $btn.removeClass( 'ncm-loading' ).text( 'Get Plan' );
                alert( res.data?.message || 'Could not start checkout. Please try again.' );
            }
        } )
        .fail( () => {
            $btn.removeClass( 'ncm-loading' ).text( 'Get Plan' );
            alert( 'Connection error. Please try again.' );
        } );
    } );

    // Manage billing portal button
    $( document ).on( 'click', '.ncm-manage-billing', function () {
        const $btn = $( this );
        $btn.addClass( 'ncm-loading' ).text( 'Opening portal…' );

        $.ajax( {
            url:    NCM.ajax_url,
            method: 'POST',
            data: { action: 'ncm_create_portal', nonce: NCM.stripe_nonce },
        } )
        .done( ( res ) => {
            if ( res.success && res.data.portal_url ) {
                window.location.href = res.data.portal_url;
            } else {
                $btn.removeClass( 'ncm-loading' ).text( 'Manage Billing' );
            }
        } );
    } );

} )( jQuery );

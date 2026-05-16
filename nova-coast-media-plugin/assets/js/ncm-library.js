( function ( $ ) {
    'use strict';
    const Lib = {
        state: { location: '', media_type: '', orientation: '', search: '', page: 1, loading: false },
        init() {
            $( document ).on( 'change', '.ncm-filter-location',    e => { this.state.location    = e.target.value; this.reload(); } );
            $( document ).on( 'change', '.ncm-filter-type',        e => { this.state.media_type  = e.target.value; this.reload(); } );
            $( document ).on( 'change', '.ncm-filter-orientation', e => { this.state.orientation = e.target.value; this.reload(); } );
            $( document ).on( 'click',  '.ncm-filter-clear', () => {
                this.state = { ...this.state, location: '', media_type: '', orientation: '', search: '', page: 1 };
                $( 'select.ncm-filter-location, select.ncm-filter-type, select.ncm-filter-orientation' ).val( '' );
                $( 'input[type="radio"].ncm-filter-location[value=""], input[type="radio"].ncm-filter-type[value=""], input[type="radio"].ncm-filter-orientation[value=""]' ).prop( 'checked', true );
                $( '.ncm-search-input' ).val( '' );
                this.fetch( true );
            } );
            let deb;
            $( document ).on( 'input', '.ncm-search-input', e => { clearTimeout( deb ); deb = setTimeout( () => { this.state.search = e.target.value.trim(); this.reload(); }, 350 ); } );
            $( document ).on( 'submit', '.ncm-search-form', e => e.preventDefault() );
            $( document ).on( 'click', '.ncm-load-more', () => { this.state.page++; this.fetch( false ); } );
            this.bindVideoHover();
        },
        reload() { this.state.page = 1; this.fetch( true ); },
        fetch( reset ) {
            if ( this.state.loading ) return;
            this.state.loading = true;
            const $g = $( '.ncm-asset-grid' );
            if ( reset ) $g.addClass( 'ncm-grid--loading' );
            $.ajax( { url: NCM_Library.ajax_url, method: 'POST', data: { action: 'ncm_filter_assets', nonce: NCM_Library.nonce, ...this.state } } )
            .done( res => {
                if ( ! res.success ) return;
                reset ? $g.html( res.data.html ) : $g.append( res.data.html );
                $( '.ncm-load-more' ).toggle( res.data.has_more );
                if ( ! res.data.html.trim() && reset ) $g.html( '<p class="ncm-no-results">No assets match these filters.</p>' );
                this.bindVideoHover();
            } )
            .always( () => { this.state.loading = false; $g.removeClass( 'ncm-grid--loading' ); } );
        },
        bindVideoHover() {
            $( document ).off( 'mouseenter.ncmv mouseleave.ncmv', '.ncm-asset-card' );
            $( document ).on( 'mouseenter.ncmv', '.ncm-asset-card[data-type="video"]', function () {
                const v = this.querySelector( '.ncm-thumb-video' );
                if ( v ) v.play().catch( () => {} );
            } );
            $( document ).on( 'mouseleave.ncmv', '.ncm-asset-card[data-type="video"]', function () {
                const v = this.querySelector( '.ncm-thumb-video' );
                if ( v ) { v.pause(); v.currentTime = 0; }
            } );
        },
    };
    $( () => Lib.init() );
} )( jQuery );

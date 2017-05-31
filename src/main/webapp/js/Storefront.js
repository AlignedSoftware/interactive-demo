/* Copyright (c) 2013-2015 NuoDB, Inc. */

/**
 * This file contains Storefront controller logic. It's all encapsulated in the "Storefront" global namespace.
 */

var Storefront = {
    init: function(cfg) {
        var me = this;

        // Set basic app properties
        me.currency = cfg.localInstance.currency;
        me.tenant = cfg.localInstance.tenantName;
        me.aggregateRegions(cfg.appInstances);

        // Render menu template
        $('#storefront-name').text(cfg.localInstance.name);
        
        // Initialize elements shared across pages
        me.initSearchBox();
        if (window.self === window.top) {
            $('#admin-link').show();
        }

        // Initialize page-specific elements
        switch (cfg.pageName) {
            case "welcome":
                me.initWelcomePage(cfg.pageData);
                break;
                
            case "control-panel-processes":
                me.initControlPanelProcessesPage(cfg.pageData.processes);
                break;

            case "control-panel-products":
                me.initControlPanelProductsPage(cfg.pageData.stats);
                break;
                
            case "control-panel-database":
                me.initControlPanelDatabasePage(cfg.pageData);
                break;

            case "control-panel-regions":
                me.initControlPanelRegionsPage(cfg.pageData.regions);
                break;

            case "control-panel-tenants":
                me.initControlPanelTenantsPage(cfg.pageData.tenants);
                break;
                
            case "control-panel-users":
                me.initControlPanelUsersPage(cfg);
                break;
                
            case "store-products":
                me.initProductsPage(cfg.pageData.products, cfg.pageData.categories, cfg.pageData.filter);
                break;

            case "store-product":
                me.initProductPage(cfg.pageData, cfg.customer);
                break;

            case "store-cart":
                me.initCartPage(cfg.pageData);
                break;
                
            case "tour-multi-tenancy":
            case "tour-no-knobs-admin":
                $('.lnk-console').attr('href', me.fixupHostname(cfg.pageData.adminConsoleUrl));
                break;
        }

        // Show accumulated messages
        me.TemplateMgr.applyTemplate('tpl-messages', '#messages', cfg.messages);

        // Disable buttons after form submission
        $(document).on('submit', 'form', function() {
            // disable *after* form submit, otherwise values are not sent
            var btns$ = $(this).find('button');
            setTimeout(function() {
                btns$.attr('disabled', 'disabled');
            }, 0);
            me.startProgressBar();
        });
        
        // Hook commands
        $('a.command').click(function() {
            me.submitCommand($(this).text());
        });
    },
    
    startProgressBar: function() {
        $('#progress-container').fadeIn();
        var pct = 0;
        setInterval(function() {
            $('#progress-container .bar').css('width', Math.min(100, (pct += 2)) + '%');
        }, 500);
    },
    
    submitCommand: function(cmd) {
        var form$ = $('<form method="POST"><button name="btn-msg" type="submit" value="' + cmd + '"></form>');
        form$.appendTo('body').find('button').click();
    },

    initSearchBox: function() {
        $('.search').click(function(event) {
            var txt = $('.search-query', this);
            if ($(event.target).hasClass('search-clear')) {
                // "X" button was clicked to clear out search box
                txt.val('').trigger('change').trigger('clear');
            } else {
                txt.select();
            }
            txt.focus();
        }).change(function() {
            // Toggle "X" icon in search box based on whether there's content in the box
            var txt = $('.search-query', this);
            var ico = $('.search-icon', this);
            ico[txt.val() ? 'addClass' : 'removeClass']('search-icon-clear');
        });
    },

    aggregateRegions: function(appInstances) {
        var me = this;

        // Aggregate instances to region level
        var regionMap = {};
        var regions = [];
        for ( var i = 0; i < appInstances.length; i++) {
            var instance = appInstances[i];
            var regionObj;
            if (!(regionObj = regionMap[instance.region])) {
                regionMap[instance.region] = regionObj = {
                    storeName: instance.name,
                    regionName: instance.region,
                    currency: instance.currency,
                    instances: [],
                };
                regions.push(regionObj);
            }
            regionObj.instances.push(instance);
            if (instance.local) {
                regionObj.selected = true;
            } else if (instance.currency != regionObj.currency) {
                instance.currency = 'MIXED';
            }
        }

        // Sort regions by name
        regions.sort(function(a, b) {
            return (a.name < b.name) ? -1 : (a.name == b.name) ? 0 : 1;
        });

        me.regions = regions;
        me.regionMap = regionMap;
    },

    initWelcomePage: function(data) {
        if (data.api) {
            var apiConnInfo = data.api;
            $('#api-box').removeClass('hide');
            $('#api-username').val(apiConnInfo.username).focus();
            $('#api-password').val("");
            $('#api-url').val(apiConnInfo.url);            
        } else if (data.db) {
            var dbConnInfo = data.db;
            $('#create-db-box').removeClass('hide');
            $('#username').val(dbConnInfo.username).focus();
            $('#password').val(dbConnInfo.password || "StorefrontUser");
            $('#url').val(dbConnInfo.url);
        }
        
        $('form').submit(function() {
            var fields$ = $('input:visible');
            for (var i = 0; i < fields$.length; i++) {
                if (!fields$[i].value) {
                    fields$[i].focus();
                    alert('Please specify a value for all fields.');
                    return false;
                }
            }
            return true;
        });
    },

    initProductsPage: function(products, categories, filter) {
        var me = this;
        me.filter = filter;

        // Render category list
        me.TemplateMgr.applyTemplate('tpl-category-nav', '#category-nav', categories);

        // Render product list
        me.TemplateMgr.applyTemplate('tpl-product-list', '#product-list', products);

        // Handle infinite scrolling
        me.paginator = $('#paginator');
        $(window).scroll(function() {
            if ($(window).scrollTop() + $(window).height() >= $('#product-list').offset().top + $('#product-list').height() - 500) {
                if (!me.paginator.is(':visible') && me.paginator.hasClass('loading')) {
                    me.paginator.show();
                    me.filter.page++;
                    me.updateProductList(true);
                }
            }
        });

        // Handle sort events
        $('#product-sort').on('click', 'a', function(event) {
            event.preventDefault();
            me.filter.sort = $(this).attr('data-sort');
            $('#product-sort-label').html($(this).html());
            me.updateProductList();
        });

        // Handle category clicks
        $('#category-nav').on('click', 'a', function() {
            // Toggle selection of this category
            var category = $(this).parent().attr('data-category');
            var categories = me.filter.categories || [];
            var idx = $.inArray(category, categories);
            if (idx >= 0) {
                //categories.splice(idx, 1);
                categories = [];
            } else {
                //categories.push(category);
                categories = [category];
            }
            me.filter.categories = categories;
            me.updateProductList();
        });

        // Avoid POST for search on this page -- use AJAX instead
        $('form.search').submit(function(e) {
            $('.search').change();
            return false;
        });
        $('.search').change(function() {
            var txt = $('.search-query', this);
            if (me.filter.matchText != txt.val()) {
                me.filter.matchText = txt.val();
                me.updateProductList();
            }
        });

        // Initialize UI elements on page outside the templates
        me.syncProductsPage(products);
    },

    initProductPage: function(product, customer) {
        var me = this;

        me.TemplateMgr.applyTemplate('tpl-product', '#product', product);
        
        // Load reviews
        $.ajax('api/products/' + encodeURIComponent(product.id) + '/reviews?page=1&pageSize=30&tenant=' + encodeURIComponent(Storefront.tenant), {
            type: 'GET',
            dataType: 'json'
        }).done(function(reviews) {
            me.TemplateMgr.applyTemplate('tpl-reviews', '#review-content', reviews);
        });

        // Handle "Add to Cart" form submit
        $('form.add-to-cart').submit(function(event) {
            event.preventDefault();
            $.ajax('api/customer/cart?tenant=' + encodeURIComponent(Storefront.tenant), {
                cache: false,
                data: {
                    productId: product.id,
                    quantity: parseInt($('[name=quantity]', this).val())
                },
                dataType: 'json',
                type: 'PUT'
            }).done(function(responseData) {
                document.location.href = "store-cart?tenant=" + encodeURIComponent(Storefront.tenant);
            });
        });

        // Initialize review form fields
        $('form.add-review [name=emailAddress]').val(customer.emailAddress);

        // Focus on first field when review dialog opens
        $('#dlg-add-review').on('shown', function() {
            $('[name=title]').focus();
        });

        // Handle "Add Review" form submit
        $('form.add-review').submit(function(event) {
            event.preventDefault();

            // Validate form
            var rating = $('[name=rating]', this).val();
            if (!rating) {
                alert("Please select a star rating first.");
                return;
            }

            $.ajax('api/products/' + encodeURIComponent(product.id) + '/reviews?tenant=' + encodeURIComponent(Storefront.tenant), {
                cache: false,
                data: {
                    title: $('[name=title]', this).val(),
                    comments: $('[name=comments]', this).val(),
                    emailAddress: $('[name=emailAddress]', this).val(),
                    rating: rating
                },
                dataType: 'json',
                type: 'POST'
            }).done(function(responseData) {
                document.location.reload();
            });
        });
    },

    initCartPage: function(cart) {
        var me = this;
        me.TemplateMgr.applyTemplate('tpl-cart', '#cart', cart);
    },

    syncProductsPage: function(data) {
        var me = this;

        // Reset paginator
        var hasNext = (me.filter.page < Math.floor(data.totalCount / me.filter.pageSize));
        me.paginator.hide();
        me.paginator[hasNext ? 'addClass' : 'removeClass']('loading');

        // Update search box 
        if (me.filter.matchText) {
            $('#search').val(me.filter.matchText).trigger('change');
        }

        // Update sort selection
        if (me.filter.sort) {
            var sortLabel = $('#product-sort [data-sort=' + me.filter.sort + ']').html();
            if (sortLabel) {
                $('#product-sort-label').html(sortLabel);
            }
        }

        // Update "all items" label
        $('#lbl-all-items').html(((data.totalCount != 1) ? data.totalCount.format(0) + ' products' : '1 product'));

        // Select active categories
        $('#category-nav li').removeClass('active');
        var categories = me.filter.categories;
        if (categories) {
            for ( var i = 0; i < categories.length; i++) {
                $('#category-nav li[data-category="' + categories[i] + '"]').addClass('active');
            }
        }

        delete me.updateRequest;
    },

    updateProductList: function(append) {
        var me = this;
        if (me.updateRequest) {
            if (append) {
                return;
            }
            me.updateRequest.abort();
        }
        if (!append) {
            me.filter.page = 1;
        }
        me.updateRequest = me.TemplateMgr.autoFillTemplate('product-list', 'api/products', me.filter, $.proxy(me.syncProductsPage, me), append);
    },
    
    fixupHostname: function(url) {
        var prefixToReplace = "http://localhost" ;
        if (url.substr(0, prefixToReplace.length) != prefixToReplace) {
            return url;
        }
        
        var l = window.location;
        return l.protocol + '//' + l.hostname + url.substr(prefixToReplace.length);
    }
};

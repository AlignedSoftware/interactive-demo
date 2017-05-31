/* Copyright (c) 2013-2015 NuoDB, Inc. */

(function() {
    "use strict";

    var MIN_HEAVY_CPU_UTILIZATION_PCT = 90;

    var g_app;
    var g_regionData = null;
    var g_activeWebCustomerCount = 0;

    Storefront.initControlPanelUsersPage = function(cfg) {
        var pageData = cfg.pageData;
        g_app = this;
        g_regionData = initRegionData(g_app.regions, pageData.stats);
        g_activeWebCustomerCount = pageData.activeWebCustomerCount;

        if (!jQuery.support.cors && g_regionData.instanceCount > 1) {
            cfg.messages
                    .push({
                        severity: 'WARNING',
                        message: 'Your browser does not support CORS, which is needed for this control panel to communicate with other Storefront instances.  The statistics you see here may be incomplete or inaccurate, and you may not be able to control all instances.  Please use Internet Explorer 10+ or a newer version of Chrome, Firefox, Safari, or Opera.'
                    });
        }

        initCustomersList(cfg.pageData.maxIdleSec, cfg.pageData.stopUsersWhenIdle);
        refreshStats(pageData.stats);
    };

    function initCustomersList(maxIdleSec, stopUsersWhenIdle) {
        // Render regions table
        g_app.TemplateMgr.applyTemplate('tpl-regions', '#regions', g_regionData);

        // Handle "Change" and "Hide" workload details buttons
        $('#regions').on('click', '.btn-change', function() {
            var row$ = $(this).closest('tr').addClass('active');
            row$.next().fadeIn();
        }).on('click', '.btn-hide', function() {
            var row$ = $(this).closest('tr').removeClass('active');
            row$.next().hide();
        });

        // Handle currency change dropdown
        $('#regions').on('click', '.currency .dropdown-menu a', function(e) {
            e.preventDefault();
            var regionName = $(this).closest('.region-overview').attr('data-region');
            var btn$ = $(this).closest('.currency').find('.btn-change-currency');
            changeCurrency(getRegionByName(regionName), $(this).attr('data-currency'), btn$);
        });

        // Handle idle handling change
        $('#maxIdleSec').text(Math.round(maxIdleSec / 60));
        $('#chk-stop-users-when-idle').prop('checked', stopUsersWhenIdle);
        $('#regions').on('change', '#chk-stop-users-when-idle', function(e) {
            e.preventDefault();
            changeStopUsersWhenIdle($(this).prop('checked'));
        });

        // Handle workload "Update" button
        $('#regions').on('click', '.btn-update', function(e) {
            var regionDetails$ = $(this).closest('.region-details');
            var regionName = regionDetails$.attr('data-region');
            var inputs$ = regionDetails$.find('input');

            // Validate inputs
            for ( var i = 0; i < inputs$.length; i++) {
                var f = $(inputs$[i]);
                var max = parseInt(f.attr('max'));
                var name = f.attr('data-name');
                if (isNaN(f.val()) || (f[0].validity && !f[0].validity.valid)) {
                    f.focus();
                    alert('Please enter a number.');
                    return false;
                }
                if (!isNaN(max) && f.val() > max) {
                    f.focus();
                    alert('User count for "' + name + '" cannot exceed ' + max + '.');
                    e.preventDefault();
                    return false;
                }
                if (f.val() < 0) {
                    alert('User count for "' + name + '" cannot be negative.');
                    e.preventDefault();
                    f.focus();
                    return false;
                }
            }

            // Serialize data
            var data = inputs$.serializeObject();
            for ( var key in data) {
                data[key] = parseInt(data[key]);
            }

            // Make changes
            updateWorkloadUsers(getRegionByName(regionName), data, $(this));
        });

        // Handle <Enter> key on input field as an "Update" click
        $('#regions').on('keypress', 'input', function(e) {
            if (e.which == 13) {
                $(this).closest('.details-box').find('.btn-update').trigger('click');
            }
        });

        // Handle "Stop all" button
        $('#btn-stop-all').click(function() {
            var data = {};
            for ( var i = 0; i < g_regionData.workloads.length; i++) {
                data['workload-' + g_regionData.workloads[i].workload.name] = 0;
            }
            updateWorkloadUsers(null, data, $('.btn-update'));
        });

        // Handle refresh
        $('#btn-refresh').click(function() {
            document.location.reload();
        });

        // Handle tooltips
        $('div[data-toggle="tooltip"]').tooltip();

        // Select quantity upon focus
        $('input[type=number]').on('click', function(e) {
            $(this).select();
            $(this).focus();
        });

        // Enable HTML5 form features in browsers that don't support it
        $('form').form();
    }

    function initRegionData(regions, stats) {
        var workloadTemplates = convertWorkloadMapToSortedList(stats.workloadStats);
        var workloadList = [];
        var instanceCount = 0;
        for ( var i = 0; i < regions.length; i++) {
            var region = regions[i];
            region.workloads = [];
            region.instanceCountLabel = pluralize(region.instances.length, "instance");
            instanceCount += region.instances.length;

            // Initialize workload data
            for ( var j = 0; j < workloadTemplates.length; j++) {
                var workload = workloadTemplates[j];
                var workloadCopy = {
                    activeWorkerCount: 0,
                    workload: $.extend({}, workload.workload)
                };
                region.workloads.push(workloadCopy);
                if (i == 0) {
                    workloadList.push($.extend({}, workloadCopy));
                }
            }
        }

        return {
            regions: regions,
            workloads: workloadList,
            instanceCount: instanceCount,
            regionSummaryLabel: pluralize(instanceCount, "Storefront instance") + ' across ' + pluralize(regions.length, 'region')
        };
    }

    function refreshStats(localStats) {
        for ( var i = 0; i < g_regionData.regions.length; i++) {
            var region = g_regionData.regions[i];

            for ( var j = 0; j < region.instances.length; j++) {
                var instance = region.instances[j];
                if (instance.isRefreshing) {
                    break;
                }

                if (localStats && instance.local) {
                    // We already have the local stats on hand, so don't bother doing an AJAX request to re-fetch them
                    refreshInstanceStatsComplete(region, instance, localStats);
                } else {
                    refreshInstanceStats(region, instance);
                }
            }
        }
    }

    function syncInstanceStatusIndicator(region, instance) {
        syncStatusIndicator($('#regions [data-region="' + region.regionName + '"] .dropdown > a .label-status'), region);
        syncStatusIndicator($('#regions [data-instance="' + instance.uuid + '"] .label-status'), instance);
    }

    function refreshInstanceStats(region, instance) {
        instance.isRefreshing = true;
        region.isRefreshing = true;
        syncInstanceStatusIndicator(region, instance);

        $.ajax({
            url: buildInstanceUrl(instance, '/api/stats'),
            cache: false
        }).done(function(stats) {
            instance.notResponding = false;
            refreshInstanceStatsComplete(region, instance, stats);
        }).fail(function() {
            instance.notResponding = true;
            refreshInstanceStatsComplete(region, instance, {
                storefrontStats: {},
                workloadStats: {}
            });
        });
    }

    function refreshInstanceStatsComplete(region, instance, stats) {
        // Update instance
        instance.isRefreshing = false;
        if (stats.appInstance) {
            instance.heavyLoad = stats.appInstance.cpuUtilization >= MIN_HEAVY_CPU_UTILIZATION_PCT;
        }
        if (stats.workloadStats) {
            instance.workloadStats = stats.workloadStats;
        }

        // Update region
        region.isRefreshing = false;
        region.heavyLoad = false;
        region.notResponding = false;
        for ( var i = 0; i < region.instances.length; i++) {
            var otherInstance = region.instances[i];

            if (otherInstance.isRefreshing) {
                region.isRefreshing = true;
            }
            if (otherInstance.notResponding) {
                region.notResponding = true;
            }
            if (otherInstance.heavyLoad) {
                region.heavyLoad = true;
            }
        }

        // Update status indicator at region and instance levels
        syncInstanceStatusIndicator(region, instance);

        // Update global region stats
        recalcRegionStats();
        recalcCustomerStats();
    }

    function recalcRegionStats() {
        var activeInstances = 0;
        var heavyLoadInstances = 0;
        var notRespondingInstances = 0;

        for ( var i = 0; i < g_regionData.regions.length; i++) {
            var region = g_regionData.regions[i];

            for ( var j = 0; j < region.instances.length; j++) {
                var instance = region.instances[j];
                if (instance.notResponding) {
                    notRespondingInstances++;
                } else if (instance.heavyLoad) {
                    heavyLoadInstances++;
                } else {
                    activeInstances++;
                }
            }
        }

        $('#label-active').html(activeInstances);
        $('#label-heavy-load').html(heavyLoadInstances);
        $('#label-not-responding').html(notRespondingInstances);
    }

    function recalcCustomerStats() {
        var maxRegionUserCount = 0;
        var totalSimulatedUserCount = 0;

        for ( var i = 0; i < g_regionData.regions.length; i++) {
            var region = g_regionData.regions[i];

            // Accumulate simulated users (reported at instance level)
            var regionUserCount = 0;
            for ( var j = 0; j < region.workloads.length; j++) {
                var workload = region.workloads[j];
                workload.activeWorkerCount = 0;

                for ( var k = 0; k < region.instances.length; k++) {
                    var instance = region.instances[k];

                    // Find corresponding workload in this instance
                    if (instance.workloadStats) {
                        var workloadStats = instance.workloadStats[workload.workload.name];
                        if (workloadStats) {
                            var instanceUserCount = Math.min(workloadStats.activeWorkerCount, workloadStats.activeWorkerLimit);
                            workload.activeWorkerCount += instanceUserCount;
                            regionUserCount += instanceUserCount;
                            totalSimulatedUserCount += instanceUserCount;
                        }
                    }
                }
            }

            if (regionUserCount > maxRegionUserCount) {
                maxRegionUserCount = regionUserCount;
            }
        }

        if (maxRegionUserCount == 0) {
            maxRegionUserCount = 1; // to avoid divide by 0 NaN's
        }

        // Update bar charts
        for ( var i = 0; i < g_regionData.regions.length; i++) {
            var region = g_regionData.regions[i];
            var regionOverview$ = $('.region-overview[data-region="' + region.regionName + '"]');
            var bars$ = regionOverview$.find('.progress').children();
            var detailedBars$ = $('.region-details[data-region="' + region.regionName + '"] .progress .bar');
            var label$ = regionOverview$.find('.lbl-users');
            var regionUserCount = 0;

            for ( var j = 0; j < region.workloads.length; j++) {
                var workloadUserCount = region.workloads[j].activeWorkerCount;

                // Region bar
                $(bars$[j]).css('width', (workloadUserCount / maxRegionUserCount * 100) + '%').attr('title', formatTooltipWithCount(region.workloads[j].workload.name, workloadUserCount));

                // Detailed workload bar
                $(detailedBars$[j * 2]).css('width', (regionUserCount / maxRegionUserCount * 100) + '%');
                $(detailedBars$[j * 2 + 1]).css('width', (workloadUserCount / maxRegionUserCount * 100) + '%').attr('title', formatTooltipWithCount(region.workloads[j].workload.name, workloadUserCount));

                // Detailed label
                regionUserCount += workloadUserCount;
                $(detailedBars$[j * 2]).closest('tr').find('.lbl-users').html(workloadUserCount.format(0));

                // Input field
                $(detailedBars$[j * 2]).closest('tr').find('input').val(workloadUserCount);
            }

            // Region label
            label$.html(regionUserCount.format(0));
        }

        // Update global workload labels
        for ( var j = 0; j < g_regionData.workloads.length; j++) {
            var workload = g_regionData.workloads[j];
            var count = 0;
            for ( var i = 0; i < g_regionData.regions.length; i++) {
                count += g_regionData.regions[i].workloads[j].activeWorkerCount;
            }
            $('.customer-summary [data-workload="' + workload.workload.name + '"]').html(count);
        }
        $('#summary-users-simulated').html(pluralize(totalSimulatedUserCount, 'simulated customer'));
        $('#summary-users-real').html(pluralize(g_activeWebCustomerCount, 'real customer'));
        $('#label-web-user-count .label').html(g_activeWebCustomerCount);

        // Update tab label
        $('#lbl-customers').text((totalSimulatedUserCount).format(0));
    }

    function syncStatusIndicator(status$, obj) {
        status$.removeClass('label-refreshing label-important label-warning label-success');
        if (obj.isRefreshing) {
            status$.addClass('label-refreshing');
        } else if (obj.notResponding) {
            status$.addClass('label-important');
        } else if (obj.heavyLoad) {
            status$.addClass('label-warning');
        } else {
            status$.addClass('label-success');
        }
    }

    function convertWorkloadMapToSortedList(workloads) {
        var workloadList = [];
        for ( var key in workloads) {
            workloadList.push(workloads[key]);
        }
        workloadList.sort(function(a, b) {
            return (a.workload.name < b.workload.name) ? -1 : (a.workload.name == b.workload.name) ? 0 : 1;
        });
        return workloadList;
    }

    function formatTooltipWithCount(label, count) {
        return label + ' (' + count.format(0) + ')';
    }

    function getRegionByName(name) {
        for ( var i = 0; i < g_regionData.regions.length; i++) {
            if (g_regionData.regions[i].regionName == name) {
                return g_regionData.regions[i];
            }
        }
        return null;
    }

    function updateInstances(regions, data, onComplete) {
        var changeCount = 0;
        var failedInstances = [];

        for ( var regionIdx = 0; regionIdx < regions.length; regionIdx++) {
            var region = regions[regionIdx];

            for ( var instanceId = 0; instanceId < region.instances.length; instanceId++) {
                var instance = region.instances[instanceId];
                changeCount++;

                (function(instance) {
                    $.ajax({
                        method: 'PUT',
                        url: buildInstanceUrl(instance, '/api/app-instances'),
                        data: data,
                        cache: false
                    }).fail(function() {
                        failedInstances.push(instance.url);
                    }).always(function() {
                        if (--changeCount == 0) {
                            if (onComplete) {
                                onComplete();
                            }

                            if (failedInstances.length) {
                                alert('Unable to change settings on one or more instances:\n\n - ' + failedInstances.join('\n - '));
                            }
                        }
                    });
                })(instance);
            }
        }
    }

    function changeCurrency(region, currency, btn$) {
        btn$.attr('disabled', 'disabled').find('span').text('Changing...');

        updateInstances([region], {
            currency: currency
        }, function() {
            btn$.removeAttr('disabled').find('span').text(Handlebars.helpers.currencyFormat(currency));
        });
    }

    function changeStopUsersWhenIdle(val) {
        updateInstances(g_regionData.regions, {
            stopUsersWhenIdle: val
        });
    }

    /**
     * Updates the simulated user counts in the specified region or all regions.
     * 
     * @param targetRegion  The region to update, or null to update all regions.  The share of users is split evently across all instances in the region, with 
     *                      those appearing earlier in the list getting the leftovers when an even split is not possible.
     * @param  data         The new user counts.  The keys should be in the format of "workload-{workloadName"}.  Not all workloads need to specified.
     * @param btn$          The button to disable while the update is in progress.  The global "Stop all" button is also disabled during the update.
     */
    function updateWorkloadUsers(targetRegion, data, btn$) {
        var failedInstances = [];
        var changeCounts = {};

        $('#btn-stop-all').attr('disabled', 'disabled');
        btn$.attr('disabled', 'disabled').text('Updating...');

        for ( var i = 0; i < g_regionData.regions.length; i++) {
            var region = g_regionData.regions[i];
            if (targetRegion && region != targetRegion) {
                continue;
            }
            changeCounts[region.regionName] = region.instances.length;

            for ( var j = 0; j < region.instances.length; j++) {
                var instance = region.instances[j];
                var instanceData = {};

                // Give the instance a proportion of the total workload
                for ( var key in data) {
                    var value = Math.ceil(data[key] / (region.instances.length - j));
                    instanceData[key] = value;
                    data[key] -= value;
                }

                (function(region, instance) {
                    $.ajax({
                        method: 'PUT',
                        url: buildInstanceUrl(instance, '/api/simulator/workloads'),
                        contentType: 'application/json',
                        data: JSON.stringify(instanceData),
                        cache: false
                    }).success(function(data) {
                        instance.workloadStats = data.workloadStats;
                        recalcCustomerStats();
                    }).fail(function(response) {
                        if (response.status != 0) { // ignore aborts due to page reloading
                            failedInstances.push(instance.url);
                        }
                    }).always(function() {
                        if (--changeCounts[region.regionName] == 0) {
                            btn$.removeAttr('disabled').text('Update');

                            if ($('.btn-update[disabled]').length == 0) {
                                $('#btn-stop-all').removeAttr('disabled');
                            }

                            if (failedInstances.length) {
                                alert('Unable to change currency on one or more instances:\n\n - ' + failedInstances.join('\n - '));
                            }
                        }
                    });
                })(region, instance);
            }
        }
    }

    function buildInstanceUrl(instance, url) {
        return ((instance.local) ? '.' : instance.url) + url + '?tenant=' + encodeURIComponent(Storefront.tenant);
    }
})();

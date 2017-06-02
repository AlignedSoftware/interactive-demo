/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.service.storefront;

import org.apache.log4j.Logger;

import com.nuodb.storefront.StorefrontTenantManager;
import com.nuodb.storefront.dal.IStorefrontDao;
import com.nuodb.storefront.dal.TransactionType;
import com.nuodb.storefront.model.dto.DbRegionInfo;
import com.nuodb.storefront.model.entity.AppInstance;
import com.nuodb.storefront.model.type.Currency;

/**
 * Performs initialization of an {@class AppInstance} when a Hibernate session factory is created.
 */
public class AppInstanceInitService {
    private final IStorefrontDao dao;

    public AppInstanceInitService(IStorefrontDao dao) {
        this.dao = dao;
    }

    public void init(final AppInstance app) {
        dao.runTransaction(TransactionType.READ_ONLY, null, new Runnable() {
            public void run() {
                // Init region name
                DbRegionInfo region;
                try {
                    region = dao.getCurrentDbNodeRegion();
                } catch (Exception e) {
                    region = null;
                }

                if (region == null) {
                    Logger logger = StorefrontTenantManager.getTenant(app.getTenantName()).getLogger(getClass());
                    logger.warn("Your database version does not support regions.  Upgrade to NuoDB 2.0 or greater.");
                } else {
                    app.setRegion(region.regionName);
                    app.setNodeId(region.nodeId);
                }

                // Init currency
                try {
                    Currency currency = dao.getRegionCurrency(app.getRegion());
                    if (currency != null) {
                        app.setCurrency(currency);
                    }
                } catch (Exception e) {
                    // Schema may not be created yet
                }
            };
        });
    }
}

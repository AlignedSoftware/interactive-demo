/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.api;

import java.util.Enumeration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.apache.commons.lang3.StringUtils;

import com.nuodb.storefront.StorefrontTenantManager;
import com.nuodb.storefront.model.dto.DbConnInfo;
import com.nuodb.storefront.model.entity.AppInstance;
import com.nuodb.storefront.model.type.Currency;
import com.nuodb.storefront.service.IStorefrontTenant;
import com.nuodb.storefront.servlet.StorefrontWebApp;

@Path("/app-instances")
public class AppInstanceApi extends BaseApi {
    public static Map<Long, String> activityLog = new LinkedHashMap<>();

    public AppInstanceApi() {
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<AppInstance> getActiveAppInstances(@Context HttpServletRequest req) {
        return getService(req).getAppInstances(true);
    }

    @GET
    @Path("/init-params")
    public Map<String, String> getParams(@Context HttpServletRequest req) {
        Map<String, String> map = new HashMap<String, String>();

        ServletContext ctx = req.getServletContext();
        Enumeration<String> names = ctx.getInitParameterNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            map.put("init." + name, ctx.getInitParameter(name));
        }

        names = ctx.getAttributeNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            map.put("attr." + name, ctx.getAttribute(name) + "");
        }

        return map;
    }

    @PUT
    @Produces(MediaType.APPLICATION_JSON)
    public AppInstance updateAppInstance(@Context HttpServletRequest req, @FormParam("currency") Currency currency, @FormParam("stopUsersWhenIdle") Boolean stopUsersWhenIdle) {
        AppInstance instance = StorefrontTenantManager.getTenant(req).getAppInstance();
        if (currency != null) {
            instance.setCurrency(currency);
        }
        if (stopUsersWhenIdle != null) {
            instance.setStopUsersWhenIdle(stopUsersWhenIdle);
        }
        return instance;
    }

    @PUT
    @Path("/sync")
    @Produces(MediaType.APPLICATION_JSON)
    public DbConnInfo sync(@Context HttpServletRequest req, DbConnInfo newDbConfig) {
        // Update Storefront URL info
        StorefrontWebApp.updateWebAppUrl(req);

        // Update DB info
        IStorefrontTenant tenant = getTenant(req);
        DbConnInfo dbConfig = tenant.getDbConnInfo();
        if (newDbConfig != null) {
            if (!dbConfig.equals(newDbConfig)) {
                if (!StringUtils.isEmpty(newDbConfig.getUrl())) {
                    dbConfig.setUrl(newDbConfig.getUrl());
                }
                if (!StringUtils.isEmpty(newDbConfig.getUsername())) {
                    dbConfig.setUsername(newDbConfig.getUsername());
                }
                if (!StringUtils.isEmpty(newDbConfig.getPassword())) {
                    dbConfig.setPassword(newDbConfig.getPassword());
                }

                tenant.setDbConnInfo(dbConfig);
            }
        }

        tenant.getLogger(this.getClass()).info("Received sync message with database " + newDbConfig.getDbName() + "; URL now " + tenant.getAppInstance().getUrl());
        
        // Start sending heartbeats if we aren't yet
        tenant.startUp();

        return dbConfig;
    }

    @PUT
    @Path("/log")
    @Produces(MediaType.APPLICATION_JSON)
    public Response putLog(@Context HttpServletRequest req, @FormParam("message") String message) {
        synchronized (activityLog) {
            activityLog.put(System.currentTimeMillis() / 1000, message);
        }

        return Response.ok().build();
    }

    @GET
    @Path("/log")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<Long, String> getLog(@Context HttpServletRequest req, @FormParam("lasttime") Long lastTime) {
        Map<Long, String> ret = new HashMap<>();
        boolean appendLogs = (lastTime == 0) ? true : false;

        synchronized (activityLog) {
            for (Map.Entry<Long, String> entry : activityLog.entrySet()) {
                if (appendLogs) {
                    ret.put(entry.getKey(), entry.getValue());
                }

                if (!appendLogs && entry.getKey() >= lastTime) {
                    appendLogs = true;
                }
            }
        }

        return ret;
    }
}

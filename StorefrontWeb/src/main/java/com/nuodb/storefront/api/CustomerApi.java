/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.api;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import com.googlecode.genericdao.search.SearchResult;
import com.nuodb.storefront.model.entity.Cart;
import com.nuodb.storefront.model.entity.CartSelection;
import com.nuodb.storefront.model.entity.Customer;
import com.nuodb.storefront.model.entity.Purchase;

@Path("/customer")
public class CustomerApi extends BaseApi {
    public CustomerApi() {
    }

    @GET
    @Path("/cart")
    @Produces(MediaType.APPLICATION_JSON)
    public Cart getCartSelections(@Context HttpServletRequest req, @Context HttpServletResponse resp) {
        Customer customer = getOrCreateCustomer(req, resp);
        return getService(req).getCustomerCart(customer.getId());
    }

    @PUT
    @Path("/cart")
    @Produces(MediaType.APPLICATION_JSON)
    public SearchResult<CartSelection> addToCart(@Context HttpServletRequest req, @Context HttpServletResponse resp,
            @FormParam("productId") int productId, @FormParam("quantity") int quantity) {
        Customer customer = getOrCreateCustomer(req, resp);
        int itemCount = getService(req).addToCart(customer.getId(), productId, quantity);

        SearchResult<CartSelection> result = new SearchResult<CartSelection>();
        result.setTotalCount(itemCount);
        return result;
    }

    @POST
    @Path("/checkout")
    @Produces(MediaType.APPLICATION_JSON)
    public Purchase purchase(@Context HttpServletRequest req, @Context HttpServletResponse resp) {
        Customer customer = getOrCreateCustomer(req, resp);
        return getService(req).checkout(customer.getId());
    }
}

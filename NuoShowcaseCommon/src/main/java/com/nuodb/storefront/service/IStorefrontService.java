/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.service;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.apache.log4j.Logger;

import com.googlecode.genericdao.search.SearchResult;
import com.nuodb.storefront.exception.CartEmptyException;
import com.nuodb.storefront.exception.CustomerNotFoundException;
import com.nuodb.storefront.exception.ProductNotFoundException;
import com.nuodb.storefront.model.dto.Category;
import com.nuodb.storefront.model.dto.ProductFilter;
import com.nuodb.storefront.model.dto.ProductReviewFilter;
import com.nuodb.storefront.model.dto.StorefrontStats;
import com.nuodb.storefront.model.dto.TransactionStats;
import com.nuodb.storefront.model.dto.Workload;
import com.nuodb.storefront.model.entity.AppInstance;
import com.nuodb.storefront.model.entity.Cart;
import com.nuodb.storefront.model.entity.Customer;
import com.nuodb.storefront.model.entity.Product;
import com.nuodb.storefront.model.entity.ProductReview;
import com.nuodb.storefront.model.entity.Purchase;

public interface IStorefrontService {
    public AppInstance getAppInstance();
    
    public Logger getLogger(Class<?> clazz);
    
    /**
     * Gets all categories ordered by category name.
     * 
     * To add and remove categories, assign/unassig category names directly to products.
     */
    public SearchResult<Category> getCategories();

    /**
     * Gets products matching the specified criteria. The categories and reviews of each product is not populated; to fetch this data, invoke the
     * {@link #getProduct(long)} method.
     * 
     * @return The matching products (on the specified page and/or to the specified limit, if specified) and total count of products matching the
     *         criteria.
     */
    public SearchResult<Product> getProducts(ProductFilter filter);

    public SearchResult<ProductReview> getProductReviews(ProductReviewFilter filter);

    /**
     * Gets information on a specific product, including the reviews associated with it (and the customers associated with each review).
     * 
     * @param productId
     *            The product's ID.
     * @return The product
     * @throws ProductNotFoundException
     *             No product exists with the specified productId.
     */
    public Product getProductDetails(long productId) throws ProductNotFoundException;

    /**
     * Adds a new product to the store.
     * 
     * @param name
     *            The name of the product (required).
     * @param description
     *            The description of the product (required).
     * @param imageUrl
     *            A URL linking to an image of the product (optional).
     * @param unitPrice
     *            The price of the product (required).
     * @param categories
     *            The category names associated with the product (optional).
     * @return The product, including an auto-generated product ID.
     * @throws IllegalArgumentException
     *             The price specified was negative.
     */
    public Product addProduct(String name, String description, String imageUrl, BigDecimal unitPrice, Collection<String> categories)
            throws IllegalArgumentException;

    /**
     * Associates a new review with an existing product.
     * 
     * @param customerId
     *            The ID of the customer writing the review.
     * @param productId
     *            The ID of the product being reviewed.
     * @param title
     *            The title of the review (required).
     * @param comments
     *            Detailed comments -- the "meat" of the review (optional).
     * @param emailAddress
     *            The email address of the customer. If specified, the Customer information is updated to include this email address.
     * @param rating
     *            The star rating of the review, on a scale of 1 to 5.
     * @return Information about the review, including a generated review ID.
     * @throws IllegalArgumentException
     *             The rating was out of bounds (less than 1 or greater than 5).
     * @throws CustomerNotFoundException
     *             No customer exists with the specified customerId.
     * @throws ProductNotFoundException
     *             No product exists with the specified productId.
     */
    public ProductReview addProductReview(long customerId, long productId, String title, String comments, String emailAddress, int rating)
            throws IllegalArgumentException, CustomerNotFoundException, ProductNotFoundException;

    /**
     * Gets a customer with the given ID, creating the customer if no customer yet exists with that ID. Collections within this object (cart contents
     * and purchases) are not fetched.
     * 
     * If a new customer is created, the specified customerId is ignored and a new one is auto-generated instead.
     * 
     * If the customer already exists, that customer's dateLastActive property is updated with the current time.
     * 
     * @param customerId
     *            The customer ID
     * @param workload
     *            Specifies the simulated workload repsonsible for creating this simulated cusotmer. Leave <code>null</code> if the customer is
     *            "real".
     * @return The customer (never <code>null</code>)
     */
    public Customer getOrCreateCustomer(long customerId, Workload workload);

    /**
     * Gets the contents of a customer's cart. The details of each product (reviews, etc.) are not fetched.
     * 
     * @param customerId
     *            The ID of the customer whose cart should be fetched.
     * @throws CustomerNotFoundException
     *             No customer exists with the specified customerId.
     */
    public Cart getCustomerCart(long customerId);

    /**
     * Adds a product in the given quantity to the customer's shopping cart. If the product already exists in the shopping cart, the quantity is
     * incremented by the specified value.
     * 
     * @param customerId
     *            The ID of the customer whose cart should be updated.
     * @param productId
     *            The ID of the product to add to the cart.
     * @param quantity
     *            The quantity to add.
     * @return The total number of items in the cart; this accounts for products with quantities greater than 1.
     * @throws IllegalArgumentException
     *             The quantity specified was 0 or negative.
     * @throws CustomerNotFoundException
     *             No customer exists with the specified customerId.
     * @throws ProductNotFoundException
     *             No product exists with the specified productId.
     */
    public int addToCart(long customerId, long productId, int quantity) throws IllegalArgumentException, CustomerNotFoundException,
            ProductNotFoundException;

    /**
     * Updates the cart to contain exactly the items specified with the quantities specified.
     * 
     * @param customerId
     *            The ID of the customer whose cart should be updated.
     * @param productQuantityMap
     *            Map of product IDs to quantities
     * @return The total number of items in the cart; this accounts for products with quantities greater than 1.
     * @throws IllegalArgumentException
     *             The quantity specified was negative.
     * @throws CustomerNotFoundException
     *             No customer exists with the specified customerId.
     * @throws ProductNotFoundException
     *             No product exists with the specified productId.
     */
    public int updateCart(long customerId, Map<Long, Integer> productQuantityMap) throws IllegalArgumentException, CustomerNotFoundException,
            ProductNotFoundException;

    /**
     * Converts the contents of a customer's cart to a purchase, and clears the cart.
     * 
     * @param customerId
     *            The ID of the customer completing the purchase.
     * @return The purchase object describing the purchase, including a generated purchase ID.
     * @throws CustomerNotFoundException
     *             No customer exists with the specified customerId.
     * @throws CartEmptyException
     *             No items were in the customer's shopping cart.
     */
    public Purchase checkout(long customerId) throws CustomerNotFoundException, CartEmptyException;

    /**
     * Gets statistics on all database transactions run by this service.
     */
    public Map<String, TransactionStats> getTransactionStats();

    /**
     * Fetches stats for the Storefront overall.
     * 
     * @param maxCustomerIdleTimeSec
     *            Max seconds a customer can be idle before being considered inactive.
     * 
     * @param maxAgeSec
     *            Maximum age of products, reviews, cart selections, and purchases to consider. Use <code>null</code> to provide stats on everything,
     *            or specify a value to limit the scope to items modified within the time period specified (which takes advantage of indexes to avoid
     *            full table scans).
     */
    public StorefrontStats getStorefrontStats(int maxCustomerIdleTimeSec, Integer maxAgeSec);

    public List<AppInstance> getAppInstances(boolean activeOnly);
}

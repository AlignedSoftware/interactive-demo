/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.service.datagen;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Calendar;
import java.util.Iterator;
import java.util.List;

import org.hibernate.StatelessSession;

import com.nuodb.storefront.model.entity.Customer;
import com.nuodb.storefront.model.entity.Product;
import com.nuodb.storefront.model.entity.ProductReview;
import com.nuodb.storefront.service.IDataGeneratorService;

public class DataGeneratorService implements IDataGeneratorService {
    private static final int MAX_DELETE_ATTEMPTS = 10;
    private static final int DELETE_RETRY_WAIT_MS = 100;

    private final StatelessSession session;
    private final Connection connection;
    private final String region;

    public DataGeneratorService(StatelessSession session, Connection connection, String region) {
        this.session = session;
        this.connection = connection;
        this.region = region;
    }

    
    public void close() {
        session.close();
    }

    
    public void generateAll(int numCustomers, int numProducts, int maxCategoriesPerProduct, int maxReviewsPerProduct) throws IOException {
        try {
            DataGenerator gen = new DataGenerator(region);

            // Insert customers
            for (Customer customer : gen.createCustomers(numCustomers)) {
                session.insert(customer);
            }

            // Insert products
            List<Product> products = gen.createProducts(numProducts, maxCategoriesPerProduct, maxReviewsPerProduct);
            saveProducts(products);
        } catch (SQLException e) {
            throw new IOException(e);
        }
    }

    
    public void generateProductReviews(int numCustomers, List<Product> products, int maxReviewsPerProduct) throws IOException {
        try {
            DataGenerator gen = new DataGenerator(region);

            // Insert customers
            for (Customer customer : gen.createCustomers(numCustomers)) {
                session.insert(customer);
            }

            // Insert products
            for (Product product : products) {
                Calendar now = Calendar.getInstance();
                product.setDateAdded(now);
                product.setDateModified(now);
            }
            saveProducts(products);

            // Insert product reviews
            for (ProductReview review : gen.createProductReviews(products, maxReviewsPerProduct)) {
                session.insert(review);
            }

            // Sync review stats
            connection.prepareStatement(
                    "UPDATE PRODUCT P SET" +
                            "   REVIEW_COUNT=(SELECT COUNT(*) FROM PRODUCT_REVIEW WHERE PRODUCT_ID=P.ID), " +
                            "   RATING=(SELECT AVG(RATING) FROM PRODUCT_REVIEW WHERE PRODUCT_ID=P.ID)")
                    .execute();

        } catch (SQLException e) {
            throw new IOException(e);
        }
    }

    
    public void removeAll() throws IOException {
        String[] statements = new String[] {
                "DELETE FROM CART_SELECTION",
                "DELETE FROM PURCHASE_SELECTION",
                "DELETE FROM PURCHASE",
                "DELETE FROM PRODUCT_REVIEW",
                "DELETE FROM CUSTOMER",
                "DELETE FROM PRODUCT_CATEGORY",
                "DELETE FROM PRODUCT"
        };

        for (String statement : statements) {
            for (int i = 0;; i++) {
                try {
                    connection.prepareStatement(statement).execute();
                    break;
                } catch (SQLException e) {
                    if (i < MAX_DELETE_ATTEMPTS - 1) {
                        try {
                            Thread.sleep(DELETE_RETRY_WAIT_MS);
                        } catch (InterruptedException ie) {
                            throw new IOException(ie);
                        }
                        continue;
                    }

                    // We're out of retry attempts
                    throw new IOException(e);
                }
            }
        }
    }

    protected void saveProducts(List<Product> products) throws SQLException {
        // Insert products
        for (Product product : products) {
            session.insert(product);
        }

        // Insert product categories
        StringBuilder buff = new StringBuilder();
        buff.append("INSERT INTO PRODUCT_CATEGORY (PRODUCT_ID, CATEGORY) VALUES ");
        int catCount = 0;
        for (Product product : products) {
            for (Iterator<String> iterator = product.getCategories().iterator(); iterator.hasNext();) {
                iterator.next();
                if (catCount++ > 0) {
                    buff.append(",");
                }
                buff.append("(?, ?)");
            }
        }
        
        PreparedStatement catStmt = connection.prepareStatement(buff.toString());
        int paramCount = 0;
        for (Product product : products) {
            for (String category : product.getCategories()) {
                catStmt.setLong(++paramCount, product.getId());
                catStmt.setString(++paramCount, category);
            }
        }
        catStmt.execute();
    }
}

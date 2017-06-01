/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.model.entity;

import java.math.BigDecimal;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.CollectionTable;
import javax.persistence.Column;
import javax.persistence.ElementCollection;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.Index;
import javax.persistence.JoinColumn;
import javax.validation.constraints.NotNull;

import org.hibernate.validator.constraints.Length;

@Entity
public class Product extends AutoIdEntity {
    @NotNull
    private String name;

    @NotNull
    @Length(max = 1000)
    private String description;

    private String imageUrl;

    @NotNull
    private Calendar dateAdded;

    @NotNull
    private Calendar dateModified;

    @Column(precision = 8, scale = 2)
    @NotNull
    private BigDecimal unitPrice;

    // Ideally this table would have a unique constraint on product + category, however
    // NuoDB doesn't support "alter table" statement to create unique multi-column indexes yet (DB-2700)
    // and Hibernate doesn't create the index as part of the table create.
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "Product_Category",
            joinColumns = @JoinColumn(name = "product_id"),
            indexes = { @Index(columnList = "product_id"), @Index(columnList = "category") })
    @Column(name = "category", nullable = false)
    private Set<String> categories = new HashSet<String>();

    // formula is useful for normalized data, but not fast queries (especially sorting on rating)
    // @Formula("(select avg(cast(r.rating as float(4))) from Product_Review r where r.product_id = id)")
    private Float rating;

    // formula is useful for normalized data, but not fast queries (especially sorting)
    // @Formula("(select count(r.rating) from Product_Review r where r.product_id = id)")
    private int reviewCount;

    private long purchaseCount;

    public Product() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Float getRating() {
        return rating;
    }

    public Integer getReviewCount() {
        return reviewCount;
    }

    public Calendar getDateAdded() {
        return dateAdded;
    }

    public void setDateAdded(Calendar dateAdded) {
        this.dateAdded = dateAdded;
    }

    public Calendar getDateModified() {
        return dateModified;
    }

    public void setDateModified(Calendar dateModified) {
        this.dateModified = dateModified;
    }

    public Set<String> getCategories() {
        return categories;
    }

    public void clearCategories() {
        categories = null;
    }

    /**
     * This denormalized field represents approximately how many purchases of this item have been made across all customers.
     */
    public long getPurchaseCount() {
        return purchaseCount;
    }

    public void setPurchaseCount(long purchaseCount) {
        this.purchaseCount = purchaseCount;
    }

    public void addRating(int newRating) {
        if (this.rating == null) {
            this.rating = new Float(newRating);
        } else {
            this.rating = (this.rating * this.reviewCount + newRating) / (this.reviewCount + 1);
        }
        ++this.reviewCount;
    }
}

/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.model.entity;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

@Entity
@Table(name = "Purchase_Selection", indexes = @Index(name = "idx_product_selection_date_modified", columnList = "dateModified"))
public class PurchaseSelection extends ProductSelection implements Serializable {
    private static final long serialVersionUID = 4243302747488634606L;

    @Id
    @ManyToOne
    private Purchase purchase;

    public PurchaseSelection() {
    }

    public PurchaseSelection(ProductSelection selection) {
        super(selection);
    }

    public Purchase getPurchase() {
        return purchase;
    }

    void setPurchase(Purchase purchase) {
        this.purchase = purchase;
    }
}

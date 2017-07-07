/* Copyright (c) 2013-2015 NuoDB, Inc. */

package com.nuodb.storefront.model.dto;

import java.util.HashSet;
import java.util.Set;

public class DbFootprint {
    public int hostCount;
    public int usedHostCount;
    public int usedTeHostCount;
    public int regionCount;
    public int usedRegionCount;
    public Set<String> usedRegions = new HashSet<String>();
}

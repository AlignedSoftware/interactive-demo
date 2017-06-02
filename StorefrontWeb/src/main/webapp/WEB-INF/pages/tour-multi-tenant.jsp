<%-- Copyright (c) 2013-2015 NuoDB, Inc. --%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@taglib prefix="t" tagdir="/WEB-INF/tags"%>

<t:page showHeader="false">
    <h1>Multi-Tenant</h1>

    <div class="row-fluid tour-figure tall">
        <div class="span4">
            <h3>A NuoDB database is made up of an agile collection of processes making it very inexpensive to start or stop a database...</h3>
            <div class="row-fluid">
                <div class="span6 offset3">
                    <div class="thumbnail">
                        <div class="caption">Databases</div>
                        <img src="img/tour-add.png" height="80" />
                    </div>
                </div>
            </div>
        </div>
        <div class="span1"></div>
        <div class="span4">
            <h3>...yet each database maintains its own physically separate archives and runs with its own set of security credentials</h3>
            <div class="row-fluid">
                <div class="span6">
                    <div class="thumbnail">
                        <div class="caption text-center">Throughput</div>
                        <img src="img/tour-flat.png" height="100" />
                    </div>
                </div>
                <div class="span6">
                    <div class="thumbnail">
                        <div class="caption text-center">Latency</div>
                        <img src="img/tour-flat.png" height="100" />
                    </div>
                </div>
            </div>
        </div>
    </div>

    <h3>Try it yourself:</h3>
    <t:messages />
    
    <ol class="tour-steps">
        <li>Go to the <a href="control-panel-tenants${qs}">Storefront Tenants page</a> and create a new new tenant.</li>
        <li>Click the new tenant in the list of tenants.  A browser tab will open for that tenant.  On the welcome page, follow the prompts to create the new tenant's database.</li>
        <li>Adjust users, hosts, and regions independently between tenants.  Observe that the activity remains isolated between tenants sharing the same domain.  Note that if you are running multiple Storefront instances, the tenant will not be automatically created on the others; you must add the tenant manually to each.</li>
        <li>Repeat these steps, if so desired, to add additional tenants.</li>
    </ol>
    
    <p>
        Or, you can run an isolated Storefront instance on the same host(s):
    </p>

    <ol class="tour-steps">
        <li>Download the <a href="http://repo2.maven.org/maven2/org/mortbay/jetty/jetty-runner/8.1.9.v20130131/jetty-runner-8.1.9.v20130131.jar">Jetty Runner</a> JAR file and place it in the <code>samples</code> folder of your NuoDB installation.
        </li>
        <li>Run the following command from your <code>samples</code> folder to start a second Storefront instance: <pre>java -Dstorefront.db.name=Storefront2@localhost -jar jetty-runner.jar --port 9092 ./storefront/StorefrontDemo.war</pre> You may replace <code>Storefront2</code> with your desired database name and <code>9092</code> with the desired HTTP port you wish to run on.
        </li>
        <li>Browse to the second Storefront instance at <a href="http://localhost:9092">http://localhost:9092</a>.  In the Storefront UI, create the database and product catalog.
        <li>While interacting with either this Storefront instance or the second instance, notice how each is isolated from the other.</li>
    </ol>

    <h3>To learn more:</h3>
    <ul class="tour-links">
        <li>You may also create your own databases using the <a target="_blank" class="lnk-console">Automation Console</a></li>
        <li>Read the <a href="http://www.nuodb.com/about-us/newsql-cloud-database-customers/multi-tenant-apps" target="_blank">&ldquo;HP Moonshot&rdquo; Multi-Tenant Case Study</a></li>
    </ul>
    
</t:page>

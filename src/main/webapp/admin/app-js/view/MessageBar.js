/* Copyright (c) 2013-2015 NuoDB, Inc. */

/**
 * @class App.view.MessageBar
 */
Ext.define('App.view.MessageBar', {
    extend: 'Ext.toolbar.Toolbar',
    alias: 'widget.messagebar',

    border: false,
    id: 'messagebar',
    hidden: true,

    /** @Override */
    initComponent: function() {
        var me = this;

        me.msgList = [];
        me.msgIndex = -1;

        me.items = [{
            xtype: 'tbtext',
            itemId: 'lblMessage',
            frame: true,
            text: '',
            flex: 1
        }, {
            xtype: 'container',
            layout: {
                type: 'hbox'
            },
            items: [{
                xtype: 'button',
                text: '&lt;',
                itemId: 'btnPrev',
                id: 'msg-btnPrev',
                handler: me.onPrevMessage,
                scope: me
            }, {
                xtype: 'label',
                text: '1 of 2',
                itemId: 'lblPage'
            }, {
                xtype: 'button',
                text: '&gt;',
                itemId: 'btnNext',
                id: 'msg-btnNext',
                handler: me.onNextMessage,
                scope: me
            }]
        }];

        me.callParent(arguments);

        me.lblMessage = me.down('[itemId=lblMessage]');
        me.lblPage = me.down('[itemId=lblPage]');
        me.btnAction = me.down('[itemId=btnAction]');
        me.btnPrev = me.down('[itemId=btnPrev]');
        me.btnNext = me.down('[itemId=btnNext]');

        App.app.on('statschange', me.onStatsChange, me);
        App.app.on('statsfail', me.onStatsFail, me);
        App.app.on('heavyload', me.onError, me);
        App.app.on('error', me.onError, me);
    },

    onStatsChange: function() {
        var me = this;
        me.syncMessages();
    },

    onStatsFail: function(response, instance) {
        var me = this;
        if (response.status == 0) {
            me.addMessage('Unable to connect to the Storefront API.  Verify Storefront is still running.  Retries will continue automatically.', instance);
        } else if (response.status == 410) {
            me.addMessage('Tenant has been shut down.', instance);
        } else {
            var msg = '';
            var ttl = null;
            try {
                msg = (response.responseJson || Ext.decode(response.responseText)).message;
                ttl = (response.responseJson) ? response.responseJson.ttl : 0;
            } catch (e) {
            }
            msg = Ext.String.htmlEncode(msg) || (' HTTP status ' + response.status);
            me.addMessage(Ext.String.format('{0}.  Retries will continue automatically.', msg), instance, ttl);
        }
    },

    onError: function(response, instance) {
        var me = this;
        var msg = '';
        var ttl = null;
        try {
            msg = (response.responseJson || Ext.decode(response.responseText)).message;
            ttl = (response.responseJson) ? response.responseJson.ttl : 0;
        } catch (e) {
        }
        if (!msg) {
            // No actual error.  Request may have been aborted or timed out.
            return;
        }
        me.addMessage(msg, instance, ttl);
    },
    
    addMessage: function(msg, instance, ttl) {
        var me = this;

        // Prepend instance/region info (if available)
        var prefix = '';
        if (instance) {
            prefix = Ext.String.format('<a href="{0}?tenant={1}" title="Reported by Storefront running at {0} ({2} region)">{3}</a>: &nbsp;', instance.url, encodeURIComponent(App.app.tenant), instance.region, me.extractHost(instance.url));
        } else {
            prefix = '<b>The Storefront has a problem:</b> &nbsp;';
        }
        msg = prefix + msg;

        var now = new Date().getTime();
        var uuid = instance ? instance.uuid : '';
        var displayUntil = (ttl) ? now + ttl : now + App.app.msgDefaultDisplayTimeMs;

        // Update existing message (if it exists)
        var found = false;
        for ( var i = 0; i < me.msgList.length; i++) {
            var msgObj = me.msgList[i];
            if (msgObj.uuid == uuid) {
                msgObj.message = msg;
                msgObj.displayUntil = displayUntil;
                found = true;
                break;
            }
        }

        if (!found) {
            me.msgList.push({
                message: msg,
                uuid: uuid,
                displayUntil: displayUntil
            });
        }

        me.syncMessages();
    },

    syncMessages: function() {
        var me = this;
        me.purgeOldMessages();

        // Hide message bar if no messages are available
        if (me.msgList.length == 0) {
            me.msgIndex = -1;
            me.setVisible(false);
            return;
        }

        // Ensure index is within bounds
        if (me.msgIndex < 0) {
            me.msgIndex = 0;
        } else if (me.msgIndex >= me.msgList.length) {
            me.msgIndex = me.msgList.length - 1;
        }

        // Display message at specific index
        var msgObj = me.msgList[me.msgIndex];
        me.lblMessage.setText(msgObj.message);
        me.setVisible(true);

        // Display prev/next buttons if there are multiple messages
        me.btnPrev.setVisible(me.msgList.length > 1);
        me.btnNext.setVisible(me.msgList.length > 1);
        me.lblPage.setVisible(me.msgList.length > 1);
        me.lblPage.setText((me.msgIndex + 1) + ' of ' + me.msgList.length);
    },

    onNextMessage: function() {
        var me = this;
        me.msgIndex++;
        if (me.msgIndex >= me.msgList.length) {
            me.msgIndex = 0;
        }
        me.syncMessages();
    },

    onPrevMessage: function() {
        var me = this;
        me.msgIndex--;
        if (me.msgIndex < 0) {
            me.msgIndex = me.msgList.length - 1;
        }
        me.syncMessages();
    },

    purgeOldMessages: function() {
        var me = this;
        var now = new Date().getTime();
        for ( var i = me.msgList.length - 1; i >= 0; i--) {
            var msg = me.msgList[i];
            if (msg.displayUntil <= now) {
                me.msgList.splice(i, 1);
            }
        }
    },
    
    extractHost: function(url) {
        var match = /http(?:s)?\:\/\/([^\:\/]+)/.exec(url);
        return (match) ? match[1] : url;
    }
});

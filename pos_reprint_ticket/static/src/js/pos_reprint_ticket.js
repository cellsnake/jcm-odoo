odoo.define('pos_reprint_ticket.pos_reprint_ticket', function (require) {
    //"use strict";

    gui = require('point_of_sale.gui');
    BaseWidget = require('point_of_sale.BaseWidget');
    models = require('point_of_sale.models');
    screens = require('point_of_sale.screens');
    chrome = require('point_of_sale.chrome');
    core = require('web.core');
    Model = require('web.DataModel');
    PopUps = require('point_of_sale.popups');
    Nuevo = PopUps.PopupWidget;
    QWeb = core.qweb;
    _t = core._t;
    console.log("hola loco ")


    /*************************************************************************
     New Widget ButtonReprintWidget:
     * On click, display a new screen to select done orders;
     */
    var ButtonReprintWidget = BaseWidget.extend({
        template: 'ButtonReprintWidget',
        icon: '/point_of_sale/static/src/img/icons/png48/printer.png',

        renderElement: function () {
            var self = this;
            this._super();
            this.$el.click(function () {
                //var ss = self.pos.pos_widget.screen_selector;
                self.gui.show_screen('rereprintticket')

            });
        },
    });

    var SelectReprintOptionWidget = BaseWidget.extend({
        template: 'SelectReprintOption',

        start: function () {
            console.log("start SelectReprintOption");
            var self = this;

            this.$('#popup-reprint-cancel').off('click').click(function () {
                current_order = self.pos.get('selectedOrder');
                // reset selected paymentline
                current_order.selected_paymentline = undefined;
                self.reset_order(current_order);
                self.current_order_name = '';
                self.hide();
            });

            this.$('.btn-reprint-gift-ticket').click(function () {
                instance.webclient.loading.$el.text(_t("Loading"));
                self.reprint_ticket('gifticket');
                self.current_order_name = '';
            });
            this.$('.btn-reprint-ticket').click(function () {
                //reset loading message to Loading
                instance.webclient.loading.$el.text(_t("Loading"));
                self.reprint_ticket('ticket');
                self.current_order_name = '';
            });

        },

        show: function (options) {
            console.log("show SelectReprintOption");

            options = options || {};
            var self = this;
            this.order_id = options.order_id;
            this.partner_id = options.partner_id;
            this.current_order_name = '';
            this._super(options);


            $.when(self.reprint_temp_ticket()).then(function (current_order, name) {
                //var order = this.pos.get('selectedOrder');
                $('.receipt-reprint', self.$el).html(QWeb.render('PosTicket', {
                    widget: self,
                    order: current_order,
                    orderlines: current_order.get('orderLines').models,
                    paymentlines: current_order.get('paymentLines').models,
                }));

                self.current_order_name = name;
            });

        },

        reprint_temp_ticket: function () {
            console.log("reprint_temp_ticket ...")
            var finish = $.Deferred();
            var self = this;
            var order_id = self.order_id;

            //reset order
            current_order = self.pos.get('selectedOrder');
            self.reset_order(current_order);

            var current_name = current_order.getName();

            //takes $deferred.promise
            order_to_print = self.load_reprint_order(order_id);

            order_to_print.done(function (old_order) {
                var current_order = self.pos.get('selectedOrder');

                var lines = old_order.orderlines;
                _.each(lines, function (line) {
                    var product_id = line.product_id[0];
                    var product = self.pos.db.get_product_by_id(product_id);
                    var options = self.prepare_orderline(line);

                    current_order.addProduct(product, options);
                    self.add_serial_number_info(line);
                });

                //set name client if exist
                current_order.set('name', old_order.name);
                var client_id = old_order.partner_id;
                var client = self.pos.db.get_partner_by_id(client_id);
                if (client) {
                    current_order.set_client(client);
                }

                //recovery paymentlines old order
                var old_payments = old_order.payments;

                _.each(old_payments, function (payment) {
                    var journal_id = payment[1];
                    var cash_register = self.get_cash_register(journal_id);
                    current_order.addPaymentline(cash_register);

                    //recovery amount for each old paymentline
                    var old_amount = payment[0];
                    current_order.selected_paymentline.set_amount(old_amount);
                });

                //set old date_order to current order
                current_order['old_date'] = old_order.date_order;
                finish.resolve(current_order, current_name);
            }).fail(function (error) {
                console.error(error);
            });

            return finish.promise();
        },

        reprint_ticket: function (value) {
            var self = this;
            var order_id = self.order_id;

            //reset order
            var current_order = self.pos.get('selectedOrder');
            self.reset_order(current_order);

            //takes $deferred.promise
            order_to_print = self.load_reprint_order(order_id);

            order_to_print.done(function (old_order) {
                var current_order = self.pos.get('selectedOrder');

                var lines = old_order.orderlines;
                _.each(lines, function (line) {
                    var product_id = line.product_id[0];
                    var product = self.pos.db.get_product_by_id(product_id);
                    var options = self.prepare_orderline(line);

                    current_order.addProduct(product, options);
                    self.add_serial_number_info(line);
                });

                //set name client if exist
                current_order.set('name', old_order.name);
                var client_id = old_order.partner_id;
                var client = self.pos.db.get_partner_by_id(client_id);
                if (client) {
                    current_order.set_client(client);
                }

                //recovery paymentlines old order
                var old_payments = old_order.payments;

                _.each(old_payments, function (payment) {
                    var journal_id = payment[1];
                    var cash_register = self.get_cash_register(journal_id);
                    current_order.addPaymentline(cash_register);

                    //recovery amount for each old paymentline
                    var old_amount = payment[0];
                    current_order.selected_paymentline.set_amount(old_amount);
                });

                //set loading message blank, this avoid print text "Loading"
                instance.webclient.loading.$el.text("");

                if (self.pos.config.iface_print_via_proxy) {
                    var receipt = current_order.export_for_printing();
                    receipt['old_date'] = old_order.date_order;

                    if (value === 'ticket') {
                        self.pos.proxy.print_receipt(QWeb.render('XmlReceipt', {
                            receipt: receipt, widget: self,
                        }));
                    } else {
                        self.pos.proxy.print_receipt(QWeb.render('XmlPosGifTicket', {
                            receipt: receipt, widget: self,
                        }));
                    }

                    self.hide();

                    self.reset_sequence();
                    current_order.destroy();

                } else {

                    self.reset_sequence();
                    current_order['old_date'] = old_order.date_order;
                    if (value === 'ticket') {
                        self.pos_widget.screen_selector.set_current_screen('receipt');
                    } else {
                        //control field, for validate order in refresh method
                        current_order['print_gift'] = true;
                        self.pos_widget.screen_selector.set_current_screen('receipt');
                    }
                }
            })
        },

        add_serial_number_info: function (line) {
            var order = this.pos.get('selectedOrder');
            if (line.serial_number_id) {
                var last_order_line = order.getLastOrderline();
                last_order_line.serial_number_id = line.serial_number_id[0]
                last_order_line.serial_number_name = line.serial_number_id[1]
                //_.extend(last_order_line, {serial_number_name: line.serial_number_id[1]})
                last_order_line.trigger('change', last_order_line);
            }
        },

        load_reprint_order: function (order_id) {
            var done = new $.Deferred();
            PosOrder = new instance.web.Model('pos.order');
            orders = PosOrder.call('load_reprint_order', [order_id]).then(function (orders) {
                var order = orders[0];
                done.resolve(order);
            }).fail(function (error) {
                done.reject(error);
            });
            return done.promise();
        },

        prepare_orderline: function (line) {
            /*todo: preparar una rutina para checar productos repetidos para no mergear*/
            var options = {
                quantity: line.qty,
                price: line.price_unit,
                discount: line.discount,
                merge: false
            };

            if (line.serial_number_id) {
                options.reprint = true;
                options.lot_id = line.serial_number_id;
            }
            return options;
        },

        get_cash_register: function (journal_id) {
            var cashregister_collection = this.pos.cashregisters;
            var cash_register;
            for (i = 0; i < cashregister_collection.length; i++) {
                if (cashregister_collection[i].journal.id === journal_id) {
                    cash_register = cashregister_collection[i];
                }
            }
            /*_.each(cashregister_collection, function (cashregister) {
             if (cashregister.journal_id[0] === journal_id) {
             cash_register = cashregister;
             }
             });*/
            return cash_register;
        },

        reset_order: function (order) {
            if (order) {
                order.set_client(undefined);
                order.get('orderLines').reset();
                order.get('paymentLines').reset();

                var paymentlines = order.get('paymentLines').models;
                _.each(paymentlines, function (line) {
                    //if (line.voucher !== false) currentOrder.removePaymentline(line)
                    order.removePaymentline(line) // now remove all payment lines
                });

                //if (this.current_order_name && order._printed !== undefined && !order._printed) order.set('name', this.current_order_name);
                if (this.current_order_name) order.set('name', this.current_order_name);

                //reset paymentscreen items
                this.pos_widget.order_widget.change_selected_order();
                this.pos_widget.payment_screen.renderElement();
            }
            return order;
        },

        reset_sequence: function () {
            this.pos.pos_session.sequence_number--
        },
    });




    /*pantalla reprint ticket screen*/
    var ReprintTicketScreen = screens.ScreenWidget.extend({
        template: 'ReprintTicketScreen',

        init: function (parent, options) {
            this._super(parent, options);
        },

        start: function () {
            var self = this;
            selfjc = this;
            this._super();
            console.log("start reprint screen...")
            this.$el.find('.button.back').click(function () {
                order = self.pos.get_order();

                order.set_client(undefined);
                self.chrome.screens.products.order_widget.change_selected_order();

                var paymentlines = order.get_paymentlines();
                _.each(paymentlines, function (line) {
                    order.removePaymentline(line) // now remove all payment lines
                });

                console.log("reset order ... back reprint ticket " + order.attributes.name);
                self.gui.show_screen('products')
            });

            var search_timeout = null;
            this.$('.searchbox input').on('keyup', function (event) {
                var query = this.value || '';
                self.search_orders_to_reprint(query);

            });
        },

        search_orders_to_reprint: function (query) {
            var self = this;
            var query = query;

            var order_container = $('.order-list-contents');
            order_container.innerHTML = "";
            order_container.text('');

            var PosOrder = new Model('pos.order');
            var orders = PosOrder.call('search_orders_to_reprint', [query || ''])
                .then(function (result) {
                    _.each(result, function (order) {
                        self.renderOrder(order, order_container);
                    });
                }).fail(function (error) {
                    console.error(error);
                });

        },

        renderOrder: function (order, order_container) {
            var self = this;
            console.log("render order method")
            self_render_order = this;
            var order_hmtl = QWeb.render('reprint-order', {
                widget: this,
                order: order
            });
            var oline_html = document.createElement('tbody');
            oline_html.innerHTML = order_hmtl;
            oline_html = oline_html.childNodes[1];
            $(oline_html).click(function (e) {
                self.current_order_id = parseInt(this.dataset['orderId']);
                self.partner_id = parseInt(this.dataset['partnerId']);
                self.gui.show_popup('select-reprint-popup', {
                    'title': _t('Reprint Order'),
                    'body': _t('Here again'),
                });
                /*self.pos.pos_widget.screen_selector.show_popup('select-reprint-popup', {
                 'order_id': self.current_order_id,
                 'partner_id': self.partner_id,
                 });*/


                //set client order if exist
                var client_id = self.partner_id;
                var client = self.pos.db.get_partner_by_id(client_id);
                console.log(client + " --" + client_id);

                var current_order = self.pos.get('selectedOrder');
                current_order.set_client(client || undefined);
            });

            order_container.append(oline_html);
        },

        show: function () {
            this._super();
            console.log("show reprint screen...")

            this.search_orders_to_reprint();
        },

    });

    gui.define_screen({name: 'rereprintticket', widget: ReprintTicketScreen});

    widgets = chrome.Chrome.prototype.widgets;

    widgets.push({
        'name': 'button_reprint_widget',
        'widget': ButtonReprintWidget,
        'prepend': '.pos-rightheader',
        'args': {
            'label': 'Button Reprint',
            action: function () {
                var self = this;
                this.$el.click(function () {
                    self.gui.show_screen('rereprintticket')
                });
            }
        }
    });


    jchrome = chrome;
    /*var PosWidget = module.PosWidget.extend({
     build_widgets: function () {
     this._super();

     //screen orders to reprint
     this.reprint_ticket_screen = new module.ReprintTicketScreen(this, {});
     this.reprint_ticket_screen.appendTo(this.$('.screens'));
     this.screen_selector.screen_set['reprintticket'] = this.reprint_ticket_screen;
     this.reprint_ticket_screen.hide();

     //reprint popup
     this.select_reprint_option_widget = new module.SelectReprintOptionWidget(this, {});
     this.select_reprint_option_widget.appendTo($(this.$el));
     this.screen_selector.popup_set['select-reprint-popup'] = this.select_reprint_option_widget;
     this.select_reprint_option_widget.hide();

     /**Ahora el boton es colocado despues de order-selector*/
    /*this.button_reprint_widget = new module.ButtonReprintWidget(this, {});
     this.button_reprint_widget.insertAfter(this.$('.order-selector'));
     }


     });*/
     gui.define_popup({name:'select-reprint-popup', widget: SelectReprintOptionWidget});
});

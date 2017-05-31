# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields
import pdb


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def search_orders_to_reprint(self, query):
        condition = [
            ('state', 'in', ['paid', 'done', 'invoiced']),
            ('statement_ids', '!=', False),
            '|',
            ('name', 'ilike', query),
            ('partner_id', 'ilike', query),
        ]

        fields_ = ['name', 'pos_reference', 'date_order', 'partner_id',
                   'amount_total']
        res = self.search_read(condition, fields_, limit=20)
        for x in res:
            old_date_order = fields.Datetime.from_string(x['date_order'])
            old_date_order = fields.Datetime.context_timestamp(self,
                                                               old_date_order)
            old_date_order = old_date_order.strftime('%d/%m/%Y %H:%M:%S')
            x['date_order'] = old_date_order

        return res

    @api.one
    def load_reprint_order(self):
        condition = [('order_id', '=', self.id)]
        fields_ = ['product_id', 'price_unit', 'qty', 'discount', 'serial_number_id']
        orderlines = self.lines.search_read(condition, fields_)
        payment_amounts = []
        for amt in self.statement_ids:
            if amt.amount > 0:
                payment_amounts.append([amt.amount, amt.journal_id.id])
                print amt.journal_id.type, " --- ", amt.journal_id.id

        obj_datetime = fields.Datetime.from_string(self.date_order)
        old_date_order = fields.Datetime.context_timestamp(self,
                                                           obj_datetime)
        old_date_order = old_date_order.strftime('%d/%m/%Y %H:%M:%S')

        res = {
            'id': self.id,
            'name': self.name,
            'ref': self.pos_reference,
            'partner_id': self.partner_id and self.partner_id.id or False,
            'orderlines': orderlines,
            'payments': payment_amounts,
            'date_order': old_date_order
        }
        return res

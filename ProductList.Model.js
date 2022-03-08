/*
	© 2020 NetSuite Inc.
	User may not copy, modify, distribute, or re-bundle or otherwise make available this code;
	provided, however, if you are an authorized user with a NetSuite account or log-in, you
	may use this code subject to the terms that govern your access and use.
*/

// ProductList.Model.js
// ----------------
// Handles creating, fetching and updating Product Lists
define('ProductList.Model', [
    'SC.Model',
    'Application',
    'SC.Models.Init',
    'ProductList.Item.Search',
    'Utils',
    'Configuration',
    'underscore'
], function(SCModel, Application, ModelsInit, ProductListItemSearch, Utils, Configuration, _) {
    return SCModel.extend({
        name: 'ProductList',
        // ## General settings
        configuration: Configuration.get('productList'),
        later_type_id: '2',
        quote_type_id: '4',

        verifySession: function() {
            if (
                !!_.result(this.configuration, 'loginRequired') &&
                !ModelsInit.session.isLoggedIn2()
            ) {
                throw unauthorizedError;
            }
        },

        getColumns: function() {
            return {
                internalid: new nlobjSearchColumn('internalid'),
                templateid: new nlobjSearchColumn('custrecord_ns_pl_pl_templateid'),
                name: new nlobjSearchColumn('name'),
                description: new nlobjSearchColumn('custrecord_ns_pl_pl_description'),
                owner: new nlobjSearchColumn('custrecord_ns_pl_pl_owner'),
                scope: new nlobjSearchColumn('custrecord_ns_pl_pl_scope'),
                type: new nlobjSearchColumn('custrecord_ns_pl_pl_type'),
                created: new nlobjSearchColumn('created'),
                lastmodified: new nlobjSearchColumn('lastmodified')
            };
        },

        // Returns a product list based on a given userId and id
        get: function(user, id) {
            this.verifySession();

            const filters = [
                new nlobjSearchFilter('internalid', null, 'is', id),
                new nlobjSearchFilter('isinactive', null, 'is', 'F'),
                new nlobjSearchFilter('custrecord_ns_pl_pl_owner', null, 'is', user)
            ];
            const product_lists = this.searchHelper(filters, this.getColumns(), true);

            if (product_lists.length >= 1) {
                return product_lists[0];
            }
            throw notFoundError;
        },

        // Returns the user's saved for later product list
        getSavedForLaterProductList: function(user) {
            return this.getSpecialTypeProductList(user, this.later_type_id);
        },

        getRequestAQuoteProductList: function(user) {
            return this.getSpecialTypeProductList(user, this.quote_type_id);
        },

        getSpecialTypeProductList: function(user, type_id) {
            this.verifySession();

            const filters = [
                new nlobjSearchFilter('custrecord_ns_pl_pl_type', null, 'is', type_id),
                new nlobjSearchFilter('custrecord_ns_pl_pl_owner', null, 'is', user),
                new nlobjSearchFilter('isinactive', null, 'is', 'F')
            ];
            const product_lists = this.searchHelper(filters, this.getColumns(), true);

            if (product_lists.length >= 1) {
                return product_lists[0];
            }
            const sfl_template = _(
                _(this.configuration.listTemplates).filter(function(pl) {
                    return pl.typeId && pl.typeId === type_id;
                })
            ).first();
            if (sfl_template) {
                if (!sfl_template.scope) {
                    sfl_template.scope = { id: type_id, name: 'private' };
                }

                if (!sfl_template.description) {
                    sfl_template.description = '';
                }

                return sfl_template;
            }
            throw notFoundError;
        },

        // Sanitize html input
        sanitize: function(text) {
            return text
                ? text
                      .replace(/<br>/g, '\n')
                      .replace(/</g, '&lt;')
                      .replace(/\>/g, '&gt;')
                : '';
        },

        searchHelper: function(filters, columns, include_store_items, order, template_ids) {
            // Sets the sort order
            const order_tokens = (order && order.split(':')) || [];
            const sort_column = order_tokens[0] || 'name';
            const sort_direction = order_tokens[1] || 'ASC';
            const productLists = [];

            columns[sort_column] && columns[sort_column].setSort(sort_direction === 'DESC');

            // Makes the request and format the response
            const records = Application.getAllSearchResults(
                'customrecord_ns_pl_productlist',
                filters,
                _.values(columns)
            );

            _.each(records, function(productListSearchRecord) {
                const product_list_type_text = productListSearchRecord.getText(
                    'custrecord_ns_pl_pl_type'
                );
                const last_modified_date = nlapiStringToDate(
                    productListSearchRecord.getValue('lastmodified'),
                    window.dateformat
                );
                const last_modified_date_str = nlapiDateToString(
                    last_modified_date,
                    window.dateformat
                );
                const productList = {
                    internalid: productListSearchRecord.getId(),
                    templateId: productListSearchRecord.getValue('custrecord_ns_pl_pl_templateid'),
                    name: productListSearchRecord.getValue('name'),
                    description: productListSearchRecord.getValue('custrecord_ns_pl_pl_description')
                        ? productListSearchRecord
                              .getValue('custrecord_ns_pl_pl_description')
                              .replace(/\n/g, '<br>')
                        : '',
                    owner: {
                        id: productListSearchRecord.getValue('custrecord_ns_pl_pl_owner'),
                        name: productListSearchRecord.getText('custrecord_ns_pl_pl_owner')
                    },
                    scopeId: productListSearchRecord.getValue('custrecord_ns_pl_pl_scope'),
                    scopeName: productListSearchRecord.getText('custrecord_ns_pl_pl_scope'),
                    typeId: productListSearchRecord.getValue('custrecord_ns_pl_pl_type'),
                    typeName: product_list_type_text,
                    created: productListSearchRecord.getValue('created'),
                    lastmodified: productListSearchRecord.getValue('lastmodified'),
                    lastmodifieddate: last_modified_date_str,
                    items: ProductListItemSearch.search(
                        productListSearchRecord.getValue('custrecord_ns_pl_pl_owner'),
                        productListSearchRecord.getId(),
                        include_store_items,
                        {
                            sort: 'sku',
                            order: '1',
                            page: -1
                        }
                    )
                };

                if (template_ids && productList.templateId) {
                    template_ids.push(productList.templateId);
                }

                productLists.push(productList);
            });

            return productLists;
        },

        // Retrieves all Product Lists for a given user
        search: function(user, order, mail) {
            const filters = [
                new nlobjSearchFilter('isinactive', null, 'is', 'F'),
                new nlobjSearchFilter('custrecord_ns_pl_pl_owner', null, 'is', user)
            ];
            const template_ids = [];
            const product_lists = this.searchHelper(
                filters,
                this.getColumns(),
                false,
                order,
                template_ids
            );
            const self = this;

            // Add possible missing predefined list templates
            _(this.configuration.listTemplates).each(function(template) {
                if (!_(template_ids).contains(template.templateId)) {
                    if (!template.templateId || !template.name) {
                        console.log(
                            'Error: Wrong predefined Product List. Please check backend configuration.'
                        );
                    } else {
                        if (!template.scopeId) {
                            template.scopeId = '2';
                            template.scopeName = 'private';
                        }

                        if (!template.description) {
                            template.description = '';
                        }

                        if (!template.typeId) {
                            template.typeId = '3';
                            template.typeName = 'predefined';
                        }

                        // This conversion to "string" is necessary since there exist an inconsistency between backend response and default values in ProductList.json
                        template.scopeId += '';

                        product_lists.push(template);
                    }
                }
            });

            if (this.isSingleList()) {
                return _.filter(product_lists, function(pl) {
                    // Only return predefined lists.
                    return pl.typeName === 'predefined';
                });
            }

            

            var product_list_results =  product_lists.filter(function(pl) {
                return pl.typeId !== self.later_type_id && pl.typeId !== self.quote_type_id;
            });

            if(mail){
                
               var a = product_list_results;
                var abc = [];
                var table = '<table>';
                for(var i = 0;i<a.length;i++)
                {
                   // table = table + 
                  // table += '<tr><td>' +  a[i].items + '<td/>'
                     abc.push(a[i].name)
                    var items = a[i].items
                    for(var j = 0;j<items.length;j++)
                    {        
                            table +='<td>'+ items[j].item.displayname + '</td>'
                            abc.push(items[j].item.displayname);  
                    }
                }
                    var xmlString = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'; 
                    xmlString += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
                    xmlString += 'xmlns:o="urn:schemas-microsoft-com:office:office" ';
                    xmlString += 'xmlns:x="urn:schemas-microsoft-com:office:excel" ';
                    xmlString += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ';
                    xmlString += 'xmlns:html="http://www.w3.org/TR/REC-html40">';
                    xmlString += '<Worksheet ss:Name="Sheet1">';
		    xmlString += '<Styles>' + '<Style ss:ID="s63">' + '<Font x:CharSet="204" ss:Size="12" ss:Color="#000000" ss:Bold="1" ss:Underline="Single"/>' + '</Style>' + '</Styles>';


                     console.warn("jhgfghbjnkl", product_list_results[0].name);
                     console.warn("jhgfghbjnkl", JSON.stringify(product_list_results[0].name));

                    var parentrow = '';
                    var row = '';
                    for(var i=0;i<product_list_results.length;i++){
                      row = '<Row>' +
                                 '<Cell ss:StyleID="s63"><Data ss:Type="String">'+ product_list_results[i].name +'</Data></Cell>' +
                            '</Row>';
                      for(var j=0;j<product_list_results[i].items.length;j++){
                          row +=  '<Row>' +
                                       '<Cell><Data ss:Type="String">'+ product_list_results[i].items[j].item.displayname +'</Data></Cell>' +
                                       '<Cell><Data ss:Type="String">'+ product_list_results[i].items[j].item.internalid +'</Data></Cell>' +
                                       '<Cell><Data ss:Type="String">'+ product_list_results[i].items[j].quantity +'</Data></Cell>' +
                                  '</Row>';
                          }
                          parentrow = parentrow + row;
                    }
                
                    xmlString += '<Table>' +   parentrow;
                
                    // for(var i=0;i<product_list_results.length;i++){
                    //     '<Row>' +
                    //         '<Cell><Data ss:Type="String">'+ product_list_results[0].name +'</Data></Cell>' +
                    //         '<Cell><Data ss:Type="String">'+ product_list_results.length +'</Data></Cell>' +
                    //     '</Row>';
                    // }
                
                    xmlString += '<Row>' + 
                                            '<Cell><Data ss:Type="String">Row 1 Column 1</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 1 Column 2</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 1 Column 3</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 1 Column 4</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 1 Column 5</Data></Cell>' + 
                                '</Row>';
                    xmlString += '<Row>' + 
                                            '<Cell><Data ss:Type="String">Row 2 Column 1</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 2 Column 2</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 2 Column 3</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 2 Column 4</Data></Cell>' + 
                                            '<Cell><Data ss:Type="String">Row 2 Column 5</Data></Cell>' + 
                                '</Row>';
                    xmlString += '</Table></Worksheet></Workbook>';
                    
                    //create file
                    var xlsFile = nlapiCreateFile('TEST.xls', 'EXCEL', nlapiEncrypt(xmlString, 'base64'));
                    //console.warn("email xls",JSON.stringify(xlsFile));
                    xlsFile.setFolder(-4);
                    //save file 
                    var fileID = nlapiSubmitFile(xlsFile);
                    console.warn(fileID);
                
                    //  for (var i=0; i<terms.length; i++) {
                    //     list += '<li data-action="hymantitleoptionselect" id="optionslists" style="width:auto;min-width:300px;cursor:pointer">' + terms[i] + '</li>';
                    //   }
                    // const emails = nlapiLookupField('customer', nlapiGetUser(),['salesrep.email','email','salesrep']);
                    // var salesrepEmail = (emails && _.has(emails,'salesrep.email'))?emails['salesrep.email']: '';
                    // var userEmail = (emails && _.has(emails,'email'))?emails['email']: '';
                    // var salesrepId = (emails && _.has(emails,'salesrep'))?emails['salesrep']: '';
                    // var recipient = "arun@cloudalp.com"                
                    // var emailMerger = nlapiCreateEmailMerger();
                    // var mergeResult = emailMerger.merge(); 
                    // var emailSubject = mergeResult.getSubject();
                    // var emailBody = JSON.stringify(product_list_results); 
                    // nlapiSendEmail(645, recipient, emailSubject, emailBody,null, null);
                    // const emails = nlapiLookupField('customer', nlapiGetUser(),['salesrep.email','email','salesrep']);
                    // var salesrepEmail = (emails && _.has(emails,'salesrep.email'))?emails['salesrep.email']: '';
                    // var userEmail = (emails && _.has(emails,'email'))?emails['email']: '';
                    // var salesrepId = (emails && _.has(emails,'salesrep'))?emails['salesrep']: '';
                    var recipient = "akenaanil90@gmail.com"//"anil@cloudalp.com"                
                   // var emailMerger = nlapiCreateEmailMerger();

                   var newAttachment = nlapiLoadFile(1066541);

                  //  nlapiSendEmail(author, recipient, subject, body, null, null, records, newAttachment);

                  //  var mergeResult = emailMerger.merge(); 
                    var emailSubject = ""//mergeResult.getSubject();
                    var emailBody = (abc); 
                    nlapiSendEmail(645, recipient, "whislist export", emailBody,null, null, null,newAttachment);
            }
            return product_list_results;
        },

        isSingleList: function() {
            const self = this;
            return (
                !this.configuration.additionEnabled &&
                this.configuration.listTemplates &&
                _.filter(this.configuration.listTemplates, function(pl) {
                    return (
                        !pl.typeId ||
                        (pl.typeId !== self.later_type_id && pl.typeId !== self.quote_type_id)
                    );
                }).length === 1
            );
        },

        // Creates a new Product List record
        create: function(user, data) {
            this.verifySession();

            const productList = nlapiCreateRecord('customrecord_ns_pl_productlist');

            data.templateId &&
                productList.setFieldValue('custrecord_ns_pl_pl_templateid', data.templateId);
            data.scopeId && productList.setFieldValue('custrecord_ns_pl_pl_scope', data.scopeId);
            data.typeId && productList.setFieldValue('custrecord_ns_pl_pl_type', data.typeId);
            data.name && productList.setFieldValue('name', this.sanitize(data.name));
            data.description &&
                productList.setFieldValue(
                    'custrecord_ns_pl_pl_description',
                    this.sanitize(data.description)
                );

            productList.setFieldValue('custrecord_ns_pl_pl_owner', user);

            return nlapiSubmitRecord(productList);
        },

        // Updates a given Product List given its id
        update: function(user, id, data) {
            this.verifySession();

            const product_list = nlapiLoadRecord('customrecord_ns_pl_productlist', id);

            if (parseInt(product_list.getFieldValue('custrecord_ns_pl_pl_owner'), 10) !== user) {
                throw unauthorizedError;
            }

            data.templateId &&
                product_list.setFieldValue('custrecord_ns_pl_pl_templateid', data.templateId);
            data.scopeId && product_list.setFieldValue('custrecord_ns_pl_pl_scope', data.scopeId);
            data.typeId && product_list.setFieldValue('custrecord_ns_pl_pl_type', data.typeId);
            data.name && product_list.setFieldValue('name', this.sanitize(data.name));
            product_list.setFieldValue(
                'custrecord_ns_pl_pl_description',
                data.description ? this.sanitize(data.description) : ''
            );

            nlapiSubmitRecord(product_list);
        },

        // Deletes a Product List given its id
        delete: function(user, id) {
            this.verifySession();

            const product_list = nlapiLoadRecord('customrecord_ns_pl_productlist', id);

            if (parseInt(product_list.getFieldValue('custrecord_ns_pl_pl_owner'), 10) !== user) {
                throw unauthorizedError;
            }

            product_list.setFieldValue('isinactive', 'T');

            const internalid = nlapiSubmitRecord(product_list);

            return internalid;
        }
    });
});

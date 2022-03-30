/*
	© 2020 NetSuite Inc.
	User may not copy, modify, distribute, or re-bundle or otherwise make available this code;
	provided, however, if you are an authorized user with a NetSuite account or log-in, you
	may use this code subject to the terms that govern your access and use.
*/

// Address.ServiceController.js
// ----------------
// Service to manage addresses requests
define('Address.ServiceController', ['ServiceController', 'Application', 'Address.Model'], function(
    ServiceController,
    Application,
    AddressModel
) {
    // @class Address.ServiceController Manage addresses requests
    // @extend ServiceController
    return ServiceController.extend({
        // @property {String} name Mandatory for all ssp-libraries model
        name: 'Address.ServiceController',

        // @property {Service.ValidationOptions} options. All the required validation, permissions, etc.
        // The values in this object are the validation needed for the current service.
        // Can have values for all the request methods ('common' values) and specific for each one.
        options: {
            common: {
                requireLogin: true
            }
        },

        // @method get The call to Address.Service.ss with http method 'get' is managed by this function
        // @return {Address.Model.Attributes | Array<Address.Model.Attributes>} one or all user addresses
        get: function() {
            const id = this.request.getParameter('internalid');
            return id ? AddressModel.get(id) : AddressModel.list() || [];
        },

        // @method post The call to Address.Service.ss with http method 'post' is managed by this function
        // @return {AddressModel.Attributes}
        post: function() {
            console.log("this.data",JSON.stringify(this.data));
            this.data['addr3'] = this.data['addr3']+'-T';
            var self = this;
            const id = AddressModel.create(this.data);

            console.log("this.data",JSON.stringify(this.data));
            var data = this.data;
            var self = this;

            for (const property in data) {
              
                  data[property] = self.data[property] !== '' ? self.data[property] : null

              }
              data['defaultbilling'] = 'F';
              data['defaultshipping'] = 'F';
              data['isvalid'] = 'T';
              data['internalid'] = String(Math.floor(1000 + Math.random() * 9000));
              console.log("data",JSON.stringify(data));


            // Do not return anything here, we need send content with status 201
            this.sendContent(AddressModel.get(id), { status: 201 });
        },

        // @method update The call to Address.Service.ss with http method 'put' is managed by this function
        // @return {Address.Model.Attributes}
        put: function() {
            const id = this.request.getParameter('internalid');
                  if(address.addr3.indexOf('undefined') != -1){
                    delete this.data.isAdded; 
                }
            AddressModel.update(id, this.data);
            return AddressModel.get(id);
        },

        // @method delete The call to Address.Service.ss with http method 'delete' is managed by this function
        // @return {StatusObject}
        delete: function() {
            const id = this.request.getParameter('internalid');
            AddressModel.remove(id);
            // If something goes wrong in the remove, an exception will fire
            return { status: 'ok' };
        }
    });
});

 
//----------------------------------------------------------------------------------------------------
/*
	© 2022 NetSuite Inc.
	User may not copy, modify, distribute, or re-bundle or otherwise make available this code;
	provided, however, if you are an authorized user with a NetSuite account or log-in, you
	may use this code subject to the terms that govern your access and use.
*/

/// <amd-module name="NewCustom"/>
import * as _ from 'underscore';
import * as Utils from '../../../Commons/Utilities/JavaScript/Utils';
import { ProfileModel } from '../../../Commons/Profile/JavaScript/Profile.Model';
import { AddressCollection } from '../../../Commons/Address/JavaScript/Address.Collection';
import Backbone = require('../../../Commons/Utilities/JavaScript/backbone.custom');

const NewCustom:any = {
    mountToApp: function(application) {

        const cart = application.getComponent('Cart');

        console.log(ProfileModel.getInstance())
             if(_.isUndefined(sessionStorage.getItem('isAdded')))
             {
                if(ProfileModel.getInstance().get('isLoggedIn') === 'T')
                {
                    console.log("isLoggedIn");
                    const profile_model = ProfileModel.getInstance();
                    if(profile_model.get('addresses').length ){
                        _.each(profile_model.get('addresses').models,function(address:any){
                            if(!_.isUndefined(address.get('isAdded')) && address.get('isAdded'))
                            {
                                address.destroy({ wait: true })
                            }
                        })
                    }
                   
                }
             }

             cart.on('afterSubmit', function(model) {
                          
                if(ProfileModel.getInstance().get('isLoggedIn') === 'T')
                {
                    console.log("isLoggedIn2");
                    const profile_model = ProfileModel.getInstance();
                    if(profile_model.get('addresses').length ){
                        _.each(profile_model.get('addresses').models,function(address:any){
                            if(!_.isUndefined(address.get('isAdded')) && address.get('isAdded'))
                            {
                                address.destroy({ wait: true })
                            }
                        })
                    }
                   
                }
                      
            });
    }   
};
export = NewCustom;
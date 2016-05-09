import React from 'react'
import { Link } from 'react-router'
import dummyData from '../../../dummy-data.json'
import sass from './app.scss'
import AddItemNotification from '../CustomOrderView/AddItemNotification/AddItemNotification'
import UsernameView from '../UsernameView/UsernameView/UsernameView'
import _ from 'lodash'
import api from '../../api'
import request from 'superagent'

var App = React.createClass({

    getInitialState: function() {
        return {
            username: '',
            userLocation: {
                lat: '',
                lng: ''
            },
            shops: [],
            selectedShop: {},
            selectedShopLocation: {
                lat: '',
                lng: ''
            },
            distance: '',
            duration: '',
            items: [],
            specialInstructions: '',
            notification: false,
            methodOfTrans: '',
            pickupTime: '',
            favorite: false,
            paymentInfo: {
                nameOnCard: '',
                cardNumber: undefined,
                expMonth: '',
                expYear: '',
                cvv: undefined
            },
            previousOrders: [],
            favoriteOrders: []
        }
    },

    // --------------INITIAL API CALL--------------

    // Calls the getLocation function which returns the user's current location
    // and passes it to its callback (_handleGetLocation)
    componentWillMount: function() {
        api.getLocation(this._handleUserLocation, this._handleGetLocation);
        this._handlePreviousOrders();
        this._handleFavoriteOrders();
    },

    _handleUsername: function(username) {
        this.setState({
            username: username
        })
        this._handleUsernameCookie(username);
    },

    _handleUsernameCookie: function(username) {
        document.cookie = "username=" + username;
        console.log(document.cookie);
    },

    // handleUsername should call a function that sets the cookie of the username, and then call a function that sets username on state. this will pull the username from the cookie and set it on state (this function will be called in componentWillMount, so when component loads, you'll check to see if cookie is there, and if it is you'll set it on state and automatically be logged in)

    // previous and favorite orders will need to filter for the username, so you need to add the username to the order you're posting, and add it to the order schema. So each order should have a username as well. previous and favorite will need to load on componentWillMount on their associated views.

    _handleUserLocation: function(position) {
        this.setState({
            userLocation: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }
        })
    },

    // Takes the user's current location from api.getLocation and passes it as the
    // first parameter to api.getShops. getShops uses this location to produce a
    // list of coffee shops within a specified radius from the user's location.
    // It also passes _handleCoffeeShopState as a second parameter, which takes the
    // results (array of objects) and sets it to this.state.shops
    _handleGetLocation: function(position) {
        api.getShops(position, this._handleCoffeeShopState)
    },

    _handleCoffeeShopState: function(results) {
        this.setState({
            shops: results
        }, this._getShopsCoordinates)
    },

    // get lat and lng from this.state.shops by running function that returns values
    // create object from those values
    // push values through api.calculateTravelTime along with this.state.userLocation, methodOfTrans (anything), and callback to set to state.
    // render values on ShopListItem
    // how is this changing the state?
    _getShopsCoordinates: function() {
        var shopsWithCoordinates = this.state.shops.map(function(shop) {
            var newShop = _.assign(
                {},
                shop,
                {shopCoordinates: {
                    lat: shop.geometry.location.lat(),
                    lng: shop.geometry.location.lng()
                }}
            )
            return newShop;
        })

        this.setState({
            shops: shopsWithCoordinates
        }, this._getShopsDistances)
    },

    _getShopsDistances: function() {
        var _handleGetShopsDistance = (response, shop) => {
            var shopsWithDistance = this.state.shops.map(function(s) {
                if (s.place_id === shop.place_id) {
                    return _.assign({}, s, {shopDistance: response.rows[0].elements[0].distance.text})
                } else {
                    return s;
                }
            })
            // console.log(shopsWithDistance);
            this.setState({
                shops: shopsWithDistance
            })
        };

        _.forEach(this.state.shops, (shop) => {
            api.calculateTravelTime(
                this.state.userLocation,
                shop.shopCoordinates,
                'driving',
                function(response) {
                  _handleGetShopsDistance(response, shop)
                }
            )
        })
    },
    //
    // _handleGetShopsDistance: function(response) {
    //
    //     this.setState({
    //         shops: shops
    //     })
    // },

    // API CALL IN RESPONSE TO USER SELECTING SHOP

    // Calls api.getDetails and passes in selected shop's place_id (shop object is about to
    // be set to this.state.selectedShop), allowing google maps api to retrieve the
    // details of the user's selected shop. It passes in _handleSelectedShopDetails as a
    // callback, which gets passed the 'place' in getDetails and overwrites previous setState
    // and sets this.state.selectedShop to place, which contains all details of shop
    _handleSelectedShop: function(shop) {
        api.getDetails(shop.place_id, this._handleSelectedShopDetails);
        this.setState({
            selectedShop: shop
        })
    },

    // This function is the second argument to getDetails, which takes the place object, and
    // sets it on this.state.selectedShop. It then calls _handleSelectedShopCoords and passes
    // the place object as its argument
    _handleSelectedShopDetails: function(place) {
        this.setState({
            selectedShop: place
        })
        this._handleSelectedShopLocation(place);
    },

    // This function receives the place object from _handleSelectedShopDetails, which contains
    // all the shop details, and then accesses the shop's coordinates on the place object, and
    // then sets those coordinates to this.state.selectedShopCoords.lat/lng
    _handleSelectedShopLocation: function(place) {
        this.setState({
            selectedShopLocation: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            },
        })
    },

    // sets user method of transportation to this.state.methodOfTrans and subsequently makes api call
    // to calculate distance and duration given user's selected method of transportation
    _handleMethodOfTrans: function(event) {
        this.setState({
            methodOfTrans: event.target.value
        })
        api.calculateTravelTime(
            this.state.userLocation,
            this.state.selectedShopLocation,
            this.state.methodOfTrans,
            this._handleDistanceAndDuration
        );
    },


    _handleDistanceAndDuration: function(response) {
        this.setState({
            distance: response.rows[0].elements[0].distance.text,
            duration: response.rows[0].elements[0].duration.text
        })
    },

    // --------------SERVER API REQUESTS--------------

    _handlePostOrder: function() {
        request.post('/api/orders')
            .set('Content-Type', 'application/json') // not required
            .send({
                items: this.state.items, // array
                specialInstructions: this.state.specialInstructions,
                selectedShop: this.state.selectedShop.name,
                selectedShop_id: this.state.selectedShop.place_id,
                favorited: this.state.favorite
            })
            .end(function(err, res){
                console.log(err);
                console.log(res);
            })
    },

    _handlePreviousOrders: function() {
        request.get('/api/orders/previous')
           .end((err, res) => {
               this.setState({
                   previousOrders: res.body
               })
           });
    },

    _handleFavoriteOrders: function() {
        request.get('/api/orders/favorites')
           .end((err, res) => {
               this.setState({
                   favoriteOrders: res.body
               })
           });
    },

    // get previous and favorite pages working and send GET requests

    // create new front end routes for previous and favorites
    // dynamic routing

    // --------------OTHER APP METHODS--------------

    _handlePickupTime: function(newValue) {
        this.setState({
            pickupTime: newValue
        })
    },

    _handleFavorite: function() {
        this.setState({
            favorite: !this.state.favorite
        })
    },

    _handleCCName: function(event) {
        var newPaymentInfo = _.assign(
            {},
            this.state.paymentInfo,
            {nameOnCard: event.target.value}
        )
        this.setState({
            paymentInfo: newPaymentInfo
        })
    },

    _handleCCNumber: function(event) {
        var newPaymentInfo = _.assign(
            {},
            this.state.paymentInfo,
            {cardNumber: event.target.value}
        )
        this.setState({
            paymentInfo: newPaymentInfo
        })
    },

    _handleCCExpMonth: function(event) {
        var newPaymentInfo = _.assign(
            {},
            this.state.paymentInfo,
            {expMonth: event.target.value}
        )
        this.setState({
            paymentInfo: newPaymentInfo
        })
    },

    _handleCCExpYear: function(event) {
        var newPaymentInfo = _.assign(
            {},
            this.state.paymentInfo,
            {expYear: event.target.value}
        )
        this.setState({
            paymentInfo: newPaymentInfo
        })
    },

    _handleCCCVV: function(event) {
        var newPaymentInfo = _.assign(
            {},
            this.state.paymentInfo,
            {cvv: event.target.value}
        )
        this.setState({
            paymentInfo: newPaymentInfo
        })
    },

    _toggleNotification: function() {
        this.setState({
            notification: !this.state.notification
        });
        var clearNotification = () => {
            this.setState({
                notification: false
            })
        };
        setTimeout(clearNotification, 3000);
    },

    _handleSpecialInstructions: function(event) {
        this.setState({
            specialInstructions: event.target.value
        })
    },

    _handleAddItemToOrder: function(itemDetails) {
        this.setState({
            items: this.state.items.concat(itemDetails),
        });
    },

    _handleDeleteItemFromOrder: function(index) {
        var items = this.state.items;
        items.splice(index, 1);
        this.setState({
            items: items
        })
    },

    render: function() {
        return (
            <div>
                <AddItemNotification
                toggleNotification={this.props.toggleNotification}
                notificationState={this.props.notificationState} />

                <nav className="main-nav">
                    <ul role="nav">
                        <Link to="/" onlyActiveOnIndex={true} className='router-link'><li>Dashboard</li></Link>
                        <Link to="/account" className='router-link'><li>Account</li></Link>
                        <Link to="/log-out" className='router-link'><li>Log Out</li></Link>
                    </ul>
                </nav>
                {!this.state.username ?
                    <UsernameView handleUsername={this._handleUsername} /> :
                    React.cloneElement(this.props.children,
                      {
                         data: dummyData,
                         username: this.state.username,
                         userLocation: this.state.userLocation,
                         selectedShopLocation: this.state.selectedShopLocation,
                         shops: this.state.shops,
                         selectedShop: this.state.selectedShop,
                         items: this.state.items,
                         handleSelectedShop: this._handleSelectedShop,
                         distance: this.state.distance,
                         duration: this.state.duration,
                         handleSpecialInstructions: this._handleSpecialInstructions,
                         specialInstructions: this.state.specialInstructions,
                         notification: this.state.notification,
                         toggleNotification: this._toggleNotification,
                         handleAddItemToOrder: this._handleAddItemToOrder,
                         handleDeleteItemFromOrder: this._handleDeleteItemFromOrder,
                         handleMethodOfTrans: this._handleMethodOfTrans,
                         methodOfTrans: this.state.methodOfTrans,
                         handlePickupTime: this._handlePickupTime,
                         pickupTime: this.state.pickupTime,
                         handleFavorite: this._handleFavorite,
                         favorite: this.state.favorite,
                         handleCCName: this._handleCCName,
                         handleCCNumber: this._handleCCNumber,
                         handleCCExpMonth: this._handleCCExpMonth,
                         expMonth: this.state.paymentInfo.expMonth,
                         handleCCExpYear: this._handleCCExpYear,
                         expYear: this.state.paymentInfo.expYear,
                         handleCCCVV: this._handleCCCVV,
                         handlePostOrder: this._handlePostOrder,
                         previousOrders: this.state.previousOrders,
                         favoriteOrders: this.state.favoriteOrders
                     })
                    }
            </div>
        )
    }
});

module.exports = App;

(function() {
	/**
	 * @author Vivek Yadav
	 */

	'use strict';
	var springDataRestApiModule = angular.module('spring-data-rest-api', []);
	var isDebug = false;
	var DEBUG = function(val) {
		if (isDebug) {
			console.log("SpringDataRestApi : LOG : ");
			console.log(val);
		}
	};
	var ERROR = function(val) {
		console.log("SpringDataRestApi : ERROR : ");
		console.log(val);
	};
	
	var LOG = function(val) {
		console.log("SpringDataRestApi : LOG : ");
		console.log(val);
	};

	springDataRestApiModule
	.provider(
			"SpringDataRestApi",
			function() {
				var provider = {};
				var config = {
						baseApiUrl : '/api',
						debug : false,
						putResponseBody : false,
						postResponseBody : false
				};
				var APIs = null;

				provider.config = function(newConfig) {
					if (newConfig) {
						if (angular.isObject(newConfig)) {
							if (newConfig.baseApiUrl) {
								config.baseApiUrl = newConfig.baseApiUrl;
							}
							if (newConfig.debug) {
								config.debug = newConfig.debug;
							}
							if(newConfig.putResponseBody){
								config.putResponseBody = newConfig.putResponseBody;
							}
							if(newConfig.postResponseBody){
								config.postResponseBody = newConfig.postResponseBody;
							}
						}
					}
					isDebug = config.debug;
					return config;
				};
				provider.APIs = function(APIobj) {
					if (APIobj) {
						APIs = APIobj._links;
					}
				};

				provider.$get = function($http,$q,$timeout) {
					var service = {};
					
					service.test = function() {
					    var deferred = $q.defer();

					    $timeout(function() {
					      deferred.resolve(['Hello', 'world!']);
					    }, 2000);

					    return deferred.promise;
					  };

					service.init = function() {
						var call = null;
						var returnObj = {
								then : function(callback) {
									call = callback;
								}
						};
						$http.get(config.baseApiUrl).then(
								function(response) {
									APIs = response.data._links;
									if (call) {
										call();
									}
								}.bind(this),
								function(response) {
									ERROR(response.status + ' : '
											+ response.statusText);
								}.bind(this));
						return returnObj;
					};

					service.list = function(repository, links,
							forceFetch, page, size, sort) {
						var deferred = $q.defer();
						if (!repository) {
							ERROR('SpringDataRestApi.list(<type of repository>) : here type of repository cannot be null');
							deferred.reject('SpringDataRestApi.list(<type of repository>) : here type of repository cannot be null');
						}
						if (!APIs) {
							service.init();
						}
						if (!APIs[repository]) {
							ERROR('Type of repository : ' + repository+ ' not found in the API');
							deferred.reject('Type of repository : ' + repository+ ' not found in the API');
						}
						var reFetch = false;
						if (forceFetch) {
							reFetch = forceFetch;
						}
						if (!APIs[repository].list) {
							APIs[repository].list = [];
							reFetch = true;
						}
						if (reFetch) {
							var fetchUrl = extractUrl(APIs[repository].href, (APIs[repository].templated)?(APIs[repository].templated):false);
							if (page!=null) {
								fetchUrl = fetchUrl + '?page=' + page;
								if (size!=null) {
									fetchUrl = fetchUrl + '&size='
									+ size;
								}
							}
							if (sort!=null && page==null) {
								fetchUrl = fetchUrl + '?sort=' + sort;
							} else if (sort!=null) {
								fetchUrl = fetchUrl + '&sort=' + sort;
							}
							$http
							.get(fetchUrl)
							.then(
									function(response) {
										APIs[repository].list = response.data._embedded[repository];
										if (links instanceof Array) {
											if(links.length > 0){
												var subLinks = fetchFirstLevelLinks(links);
												angular.forEach(APIs[repository].list,function(item) {
													angular.forEach(subLinks,function(subLink) {
														if (item._links[subLink]) {
															var newSubLinks = fetchSubLinksFor(links,subLink);
															if(!item._ref){
																item._ref = {};
															}
															item._ref[subLink] = {};
															service.get(item._links[subLink].href,newSubLinks).then(function(response){
																item._ref[subLink] = response;
															});
														} else {
															ERROR("SubLink : "+ subLink+ " not found in "+ item._links.self.href);
															deferred.reject("SubLink : "+ subLink+ " not found in "+ item._links.self.href);
														}
													},this);
												},this);
												deferred.resolve(APIs[repository].list);
											}else{
												deferred.resolve(APIs[repository].list);
											}
										}else{
											deferred.resolve(APIs[repository].list);
										}
									}.bind(this),
									function(response) {
										ERROR('Href : '+fetchUrl+' : '+response.status+ ' : '+ response.statusText);
										deferred.reject('Href : '+fetchUrl+' : '+response.status+ ' : '+ response.statusText);
									}.bind(this));
						}else{
							deferred.resolve(APIs[repository].list);
						}
						return deferred.promise;
					};

					service.get = function(href, links,isWait) {
						var deferred = $q.defer();
						var result = new Object();
						if(!angular.isObject(href)){
							href = {
							    url: href, 
							    method: "GET"
							 };
						}
						$http(href).then(
							function(response) {
								result = response.data;
								var resultItems = null;
								if (result._embedded) {
									for ( var subItem in result._embedded)
										break;
									resultItems = result._embedded[subItem];
								}
								var promises = [];
								
								if (links instanceof Array) {
									if(links.length > 0){
										var subLinks = fetchFirstLevelLinks(links);
										
										if (resultItems instanceof Array) {
											angular.forEach(resultItems,function(item) {
												angular.forEach(subLinks, function(subLink) {
													if (item._links[subLink]) {
														var newSubLinks = fetchSubLinksFor(links,subLink);
														if(!item._ref){
															item._ref = {};
														}
														item._ref[subLink] = {};
														promises.push(service.get(item._links[subLink].href,newSubLinks).then(function(response){
															item._ref[subLink] = response;
														}));
													} else {
														ERROR("SubLink : "+ subLink+ " not found in "+ item._links.self.href);
														deferred.reject("SubLink : "+ subLink+ " not found in "+ item._links.self.href);
													}
												},this);
											},this);
//											deferred.resolve(result);
										} else {
											angular.forEach(subLinks,function(subLink) {
												if (result._links[subLink]) {
													var newSubLinks = fetchSubLinksFor(links,subLink);
													if(!result._ref){
														result._ref = {};
													}
													result._ref[subLink] = {};
													promises.push(service.get(result._links[subLink].href,newSubLinks).then(function(response){
														result._ref[subLink] = response;
													}));
												} else {
													ERROR("SubLink : "+ subLink+ " not found in "+ result._links.self.href);
													deferred.reject("SubLink : "+ subLink+ " not found in "+ result._links.self.href);
												}
											},this);
//											deferred.resolve(result);
										}
										
									}
//									else{
//										deferred.resolve(result);
//									}
								}
								//else{
								if(isWait){
									$q.all(promises).then(function(values){
										deferred.resolve(result);
									});
								}
								else{
									deferred.resolve(result);
								}
									
								//}
								
							}.bind(this),
							function(response) {
								ERROR('Href : '+ href+ ' : '+ response.status+ ' : '+ response.statusText);
								deferred.reject('Href : '+ href+ ' : '+ response.status+ ' : '+ response.statusText);
							}.bind(this));
						
						return deferred.promise;
					};
					
					service.save = function(obj,repository){
						var deferred = $q.defer();
						
						if (!APIs) {
							service.init();
						}
						for(var item in obj._ref){
							if(obj._ref[item])
								if(obj._ref[item]._links)
							obj[item] = obj._ref[item]._links.self.href;
						}
						
						if(obj._links && obj._links.self){
							//PUT
							$http.put(obj._links.self.href,obj).then(
								function(response){
									if(config.putResponseBody){
										for(var item in response.data){
											obj[item] = response.data[item];
										}
									}
									deferred.resolve(response);
								}.bind(this),
								function(response){
									ERROR('PUT Error on Href : '+ postUrl+ ' : '+ response.status+ ' : '+ response.statusText);
									DEBUG(response);
									deferred.reject('PUT Error on Href : '+ postUrl+ ' : '+ response.status+ ' : '+ response.statusText);
								}.bind(this)
							);
						}else{
							//POST
							if (!repository) {
								ERROR('SpringDataRestApi.save(<object>,<type of repository>) : here type of repository cannot be null in POST');
								deferred.reject('SpringDataRestApi.save(<object>,<type of repository>) : here type of repository cannot be null in POST');
							}
							
							if (!APIs[repository]) {
								ERROR('Type of repository : ' + repository+ ' not found in the API');
								deferred.reject('Type of repository : ' + repository+ ' not found in the API');
							}
							var postUrl = extractUrl(APIs[repository].href, (APIs[repository].templated)?(APIs[repository].templated):false);
							$http.post(postUrl,obj).then(
									function(response){
										if(config.postResponseBody){
											for(var item in response.data){
												obj[item] = response.data[item];
											}
										}
										deferred.resolve(response);
									}.bind(this),
									function(response){
										ERROR('POST Error on Href : '+ postUrl+ ' : '+ response.status+ ' : '+ response.statusText);
										DEBUG(response);
										deferred.reject('POST Error on Href : '+ postUrl+ ' : '+ response.status+ ' : '+ response.statusText);
									}.bind(this)
								);
						}
						
						return deferred.promise;
					};
					
					service.remove = function(obj){
						var deferred = $q.defer();
						if(!obj._links||!obj._links.self||!obj._links.self.href){
							deferred.reject('DELETE Failed Error on Href : '+ obj._links.self.href+ ' : '+ response.status+ ' : '+ response.statusText);
						}else{
							$http.delete(obj._links.self.href).then(
								function(response){
									deferred.resolve(response);
								}.bind(this),
								function(response){
									ERROR('DELETE Error on Href : '+ obj._links.self.href+ ' : '+ response.status+ ' : '+ response.statusText);
									DEBUG(response);
									deferred.reject('DELETE Error on Href : '+ obj._links.self.href+ ' : '+ response.status+ ' : '+ response.statusText);
								}.bind(this)
							);
						}
						return deferred.promise;
					};

				return service;
			}

			return provider;
});

	function fetchFirstLevelLinks(links) {
		var firstLevelLinks = [];
		for (var i = 0; i < links.length; i++) {
			if(links[i]){
				var subLinks = links[i].split('.');
				firstLevelLinks.push(subLinks[0]);
			}
		}
		return firstLevelLinks;
	}

	function fetchSubLinksFor(links,mainLink) {
		var subLinks = null;
		for (var i = 0; i < links.length; i++) {
			var tmp = links[i].split('.')
			if(tmp.length > 1){
				var parts = links[i].split(/\.(.+)?/);
				if(parts[0]==mainLink){
					if(!subLinks){
						subLinks = new Array();
					}
					subLinks.push(parts[1]);
				}	
			}
		}
		return subLinks;
	}

	/**
	 * Returns the template parameters of the given url as object. e.g. from
	 * this url 'http://localhost:8080/categories{?page,size,sort}' it will
	 * return the following object: {'page': "", 'size': "", 'sort': ""}
	 * 
	 * @param {string}
	 *            url the url with the template parameters
	 * @returns {object} the object containing the template parameters
	 */
	function extractTemplateParameters(url) {
		var templateParametersObject = {};

		var regexp = /{\?(.*)}/g;
		var templateParametersArray = regexp.exec(url)[1].split(',');

		angular.forEach(templateParametersArray, function(value) {
			templateParametersObject[value] = "";
		});

		return templateParametersObject;
	}

	/**
	 * Removes the template parameters of the given url. e.g. from this url
	 * 'http://localhost:8080/categories{?page,size,sort}' it will remove the
	 * curly braces and everything within.
	 * 
	 * @param {string}
	 *            url the url with the template parameters
	 * @returns {string} the url without the template parameters
	 */
	function removeTemplateParameters(url) {
		return url.replace(/{.*}/g, '');
	}

	/**
	 * Extracts the url out of a url string. If template parameters exist, they
	 * will be removed from the returned url.
	 * 
	 * @param {string}
	 *            url the url string from which to extract the url
	 * @param {boolean}
	 *            templated true if the url is templated
	 * @returns {string} the url of the resource object
	 */
	function extractUrl(url, templated) {
		if (templated) {
			url = removeTemplateParameters(url)
		}
		return url;
	}

})();

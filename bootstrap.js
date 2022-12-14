const MatomoTracker = require('matomo-tracker'),
      site_trackers = {};

// Define the default options
let options = {

	// The Matomo endpoint URL
	endpoint : null,

	// The matomo PHP file
	tracker_php : 'matomo.php',

	// The matomo js file
	trakcer_js   : 'matomo.js',

	// Don't track users by default
	disable_cookies : true,

	// The Site-id to track
	site_id         : null,
};

// Inject the user-overridden options
alchemy.plugins.matomo = Object.assign(options, alchemy.plugins.matomo);
let disable = false;

if (!options.site_id) {
	console.warn('MatomoTracker is disabled: no site_id specified');
	disable = true;
}

if (!options.endpoint) {
	console.warn('MatomoTracker is disabled: no endpoint specified');
	disable = true;
}

if (disable) {
	return;
}

/**
 * Get the site_id for the given request
 *
 * @author      Jelle De Loecker   <jelle@elevenways.be>
 * @since       0.1.0
 * @version     0.1.0
 *
 * @return      {Number}
 */
function getSiteId(conduit) {
	return options.site_id;
}

/**
 * Get the correct url
 *
 * @author      Jelle De Loecker   <jelle@elevenways.be>
 * @since       0.1.0
 * @version     0.1.0
 *
 * @return      {String}
 */
function getMatomoUrl(path) {
	let url = RURL.parse(options.endpoint + '/' + path);
	return ''+url;
}

/**
 * Get the tracker for a certain site_id
 *
 * @author      Jelle De Loecker   <jelle@elevenways.be>
 * @since       0.1.0
 * @version     0.1.0
 *
 * @return      {MatomoTracker}
 */
function getTracker(conduit) {

	let site_id = getSiteId(conduit);

	let result = site_trackers[site_id];

	if (!result) {

		result = new MatomoTracker(site_id, getMatomoUrl(options.tracker_file), true);
		site_trackers[site_id] = result;
	}

	return result;
}

/**
 * Get the unique visitor id
 * (Won't be persisted)
 *
 * @author      Jelle De Loecker   <jelle@elevenways.be>
 * @since       0.1.0
 * @version     0.1.0
 *
 * @return      {String}
 */
function getVisitorId(conduit) {

	let id = conduit.session('matomo_id');

	if (!id) {
		id = Crypto.randomHex(16);
		conduit.session('matomo_id', id);
	}

	return id;
}

/**
 * Send the tracker info
 *
 * @author      Jelle De Loecker   <jelle@elevenways.be>
 * @since       0.1.0
 * @version     0.1.0
 */
Router.use(function trackMatomo(req, res, next) {

	// Immediately do the next handlers
	next();

	let conduit = req.conduit;

	if (!conduit || conduit instanceof Classes.Alchemy.Conduit.Loopback) {
		return;
	}

	if (!conduit.route || conduit.route.is_middleware || conduit.route.visible_location === false || !conduit.route.breadcrumb) {
		return;
	}

	let matomo = getTracker(conduit);

	if (!matomo) {
		return;
	}

	let user_data = conduit.session('UserData');

	let event = {
		_id    : getVisitorId(conduit),
		url    : ''+conduit.original_url,
		ua     : conduit.headers['user-agent'],
		urlref : conduit.headers['referer'],
	};

	if (user_data) {
		event.uid = String(user_data._id || user_data.$pk || '');
	}

	matomo.track(event);
}, {
	weight: 99801,
});

/**
 * Add the tracker javascript code
 *
 * @author     Jelle De Loecker   <jelle@elevenways.be>
 * @since      0.1.0
 * @version    0.1.0
 */
alchemy.hawkejs.on({
	type: 'renderer',
	status: 'begin'
}, async function onBegin(renderer) {

	if (renderer.root_renderer != renderer || !renderer.conduit) {
		return;
	}

	const conduit = renderer.conduit;

	let site_id = getSiteId(conduit),
	    visitor_id = getVisitorId(conduit),
	    url = getMatomoUrl('');

	let code = `
		var _paq = window._paq = window._paq || [];
		`;
	
	if (options.disable_cookies) {
		code += `_paq.push(['disableCookies']);\n`
	}

	code += `
		_paq.push(['trackPageView']);
		_paq.push(['enableLinkTracking']);
		(function() {
			var u="${ url }";
			_paq.push(['setTrackerUrl', u+'${ options.tracker_php }']);
			_paq.push(['setSiteId', '${ site_id }']);
			_paq.push(['setVisitorId', '${ visitor_id }']);
			`;

	code += `
			var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
			g.async=true; g.src=u+'${ options.tracker_js }'; s.parentNode.insertBefore(g,s);
		})();
		`;

	renderer.addHeadTag('script', null, code);

});
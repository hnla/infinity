(function($){
	$(document).ready(function() {

		// cpanel toolbar buttons
		var tb_menu =
			$('a#infinity-cpanel-toolbar-menu')
				.button({icons:{secondary: "ui-icon-triangle-1-s"}});
		var tb_start =
			$('a#infinity-cpanel-toolbar-start');
		var tb_refresh =
			$('a#infinity-cpanel-toolbar-refresh')
				.button({icons: {primary: "ui-icon-refresh"}})
				.attr('href', tb_start.attr('href'))
				.attr('target', tb_start.attr('target'));
		var tb_scroll =
			$('input#infinity-cpanel-toolbar-scroll')
				.button({
					icons: {primary: "ui-icon-arrow-2-n-s"},
					create: function(event, ui){
						if (Boolean(Number($.cookie('infinity_cpanel_scroll')))) {
							$(this).attr('checked', 'checked').button('refresh');
						}
					}
				}).click(function() {
					initScroll();
				});
	   
		// menus
		$('a.infinity-cpanel-context-menu').each(function() {
			var $this = $(this);
			// new menu
			var menu = $this.next().menu({
				select: function(event, ui) {
					$(this).hide();
				},
				input: $(this)
			}).hide();
			// hide other menus
			menu.parent().siblings('li').children('a').click(function(){
				menu.hide();
			});
		}).click(function(event) {
			// menu is next element
			var menu = $(this).next();
			// is it a re-click?
			if (menu.is(":visible")) {
				menu.hide();
				return false;
			}
			// display me
			menu.show()
				.css({'top': 0, 'left': 0})
				.position({
					my: "left top",
					at: "right top",
					offset: "5 -5",
					collision: "fit none",
					of: this
				});
			// hide all menus
			$(document).one("click", function() {
				menu.hide();
			});
			return false;
		});

		// main menu has a special positioning
		tb_menu.click(function(){
			$(this).next().position(
			{
				my: "left top",
				at: "left bottom",
				offset: "-7 4",
				collision: "fit none",
				of: this
			});
		});

		// cpanel elements
		var cpanel = $('div#infinity-cpanel').resizable(
			{
				minWidth: 1000,
				minHeight: 600,
				alsoResize: 'div.infinity-cpanel-tab'
			}
		);
		var cpanel_t = $('div#infinity-cpanel-tabs', cpanel);

		// init cpanel tabs
		cpanel_t.tabs({
			tabTemplate: "<li><a href='#{href}'>#{label}</a><span class='ui-icon ui-icon-close'></span></li>",
			panelTemplate: '<div class="infinity-cpanel-tab"></div>',
			add: function(event, ui) {
				$(ui.tab).attr('target', $(ui.tab).prop('hash').substring(1));
				cpanel_t.tabs('select', '#' + ui.panel.id);
			},
			remove: function(event, ui) {
				saveTab('rem', ui.tab);
			},
			select: function(event, ui) {
				$.cookie('infinity_cpanel_tab_selected', ui.panel.id, {expires: 7});
				tb_refresh.attr('href', $(ui.panel).data('infinity.href.loaded'));
				tb_refresh.attr('target', $(ui.tab).attr('target'));
			},
			show: function(event, ui) {
				initScroll($(ui.panel));
			}
		}).find('.ui-tabs-nav').sortable({
			cursor: 'move',
			containment: 'parent'
		});

		// add and/or select cpanel tab
		$('a', cpanel).live('click', function() {
			if ( identTab(this) ) {
				loadTab(this);
				return false;
			}
			return true;
		})

		// close cpanel tab
		$( 'ul.ui-tabs-nav span.ui-icon-close', cpanel_t ).live( "click", function() {
			var index = identTab($(this).prev('a'));
			cpanel_t.tabs( "remove", index );
			return false;
		});

		// return tab id that is being targeted by an anchor
		function identTab(anchor)
		{
			var $a = $(anchor),
				$targ = $a.attr('target');

			if ( ($targ) && $targ.substring(0, 20) == 'infinity-cpanel-tab-') {
				return $targ;
			} else {
				return false;
			}
		}

		// load content into a tab panel
		function loadTab(anchor)
		{
			var $anchor = $(anchor);
			var href = $anchor.attr('href');
			var tab_id = identTab($anchor);
			var message = $('<div></div>');

			saveTab('add', $anchor);

			if ( !tab_id ) {
				var panel_id = $('div.infinity-cpanel-tab:visible').attr('id');
				if ( (panel_id) && panel_id.length ) {
					tab_id = panel_id;
				} else {
					return;
				}
			}

			if ( $('div#' + tab_id).length ) {
				// panel exists
				cpanel_t.tabs('select', '#' + tab_id);
			} else {
				// the title
				var title = '';
				// find title from toolbar
				$('div#infinity-cpanel-toolbar a').each(function(){
					if ( identTab(this) == tab_id ) {
						title = $(this).attr('title');
						return false; // break!
					}
				});
				// find a title?
				if (title.length) {
					// create new panel
					cpanel_t.tabs('add', '#' + tab_id, title);
				} else {
					// not good
					alert('A tab for ' + tab_id + 'does not exist');
				}
			}

			// update refr button
			tb_refresh.attr('href', href);

			// find active panel
			var panel = $('div#' + tab_id).empty();

			// store href
			panel.data('infinity.href.loaded', href);

			// init message
			panel.prepend(
				message.pieEasyFlash('loading', 'Loading tab content.').fadeIn()
			);

			// get content for the tab
			$.post(
				ajaxurl + '?' + href.split('?').pop().split('#').shift(),
				{'action': 'infinity_tabs_content'},
				function(r) {
					var sr = pieEasyAjax.splitResponseStd(r);
					var message = panel.pieEasyFlash('find');
					if (sr.code >= 1) {
						// success
						message.fadeOut(200, function(){
							panel.html(sr.content);
							initOptionsPanel(panel);
							initDocuments(panel);
						});
					} else {
						// error
						message.fadeOut(300, function(){
							message.pieEasyFlash('error', sr.content).fadeIn();
						});
					}
				}
			);
		}

		// manage currently open tabs in a cookie
		// valid cmds: 'get', 'add', 'rem'
		function saveTab(cmd, a)
		{
			var $a = $(a);
			var c = $.cookie('infinity_cpanel_tabs_open');
			var t = (c) ? c.split('||') : [];
			var tt = new Array();
			var h = $a.attr('href');
			var i, s, m, id;

			if (cmd == 'get') {
				return t;
			} else {
				id = identTab($a);
				// must id as a tab
				if (!id) {
					id = $a.closest('div.ui-tabs-panel').attr('id');
					$a.prop('target', id);
				}
				// loop all items
				for (i in t) {
					s = t[i].split('|');
					if (s[0] == id && cmd == 'rem') {
						m = true;
						continue;
					}
					tt.push(t[i]);
				}
				if (!m && cmd == 'add') {
					tt.push(id + '|' + h);
				}
				// update cookie
				return $.cookie('infinity_cpanel_tabs_open', tt.join('||'), {expires: 7});
			}
		}

		// show scroll bars
		function initScroll(panel)
		{
			var checked = (tb_scroll.attr('checked'));

			if (!panel) {
				panel = cpanel_t.find('div.infinity-cpanel-tab:visible');
			}

			panel.toggleClass('infinity-cpanel-tab-scroll', checked);
			$.cookie('infinity_cpanel_scroll', Number(checked), {expires: 7});

			if (checked == true) {
				// calc heights
				var cp_ot = cpanel.offset().top;
				var cp_hc = ($(window).height() - cp_ot) * 0.9;
				var tp_ot, tp_hc;
				// update heights
				tp_ot = panel.offset().top;
				tp_hc = cp_hc - (tp_ot - cp_ot);
				cpanel.css({'height': cp_hc});
				panel.css({'height': tp_hc - 40});
			} else {
				// kill heights
				cpanel.height('auto');
				panel.height('auto');
			}
		}

		// load tabs on page load
		function initTabs()
		{
			var t = saveTab('get'),
				ts = $.cookie('infinity_cpanel_tab_selected'),
				i, s, a;

			if (t.length) {
				for (i in t) {
					s = t[i].split('|');
					a = $('<a></a>').attr('target', s[0]).attr('href', s[1]);
					loadTab(a);
				}
				if (ts) {
					cpanel_t.tabs('option', 'selected', ts);
				}
			} else {
				// load start by default
				loadTab(tb_start);
			}
		}

		// init all options
		function initOptions(panel)
		{
			// call pie helper
			$(panel).pieEasyOptions( 'init', 'infinity_options_update' );

			// create tabs
			$('div.infinity-cpanel-options-single', panel).each(function(){
				$(this).tabs().css('float', 'left');
			});
		}

		// init options panel
		function initOptionsPanel(panel)
		{
			// full options panel?
			if ( !$('div#infinity-cpanel-options', panel).length ) {
				// no, just init options and quit
				initOptions(panel);
				return;
			}

			// the option form
			var form = $('div#infinity-cpanel-options form', panel);
			// the menu(s)
			var menu = $('div.infinity-cpanel-options-menu', panel);
			// get last option loaded
			var last = $.cookie('infinity_cpanel_option_loaded');

			// setup accordion menu
			menu.accordion({
				autoHeight: false,
				collapsible: true,
				clearStyle: true,
				icons: {
					header: 'ui-icon-folder-collapsed',
					headerSelected: 'ui-icon-folder-open'
				},
				change: function(event, ui) {
					var states = [];
					menu.each(function(){
						var state = [
							$(this).attr('id'),
							$(this).accordion('option', 'active')
						];
						states.push(state.join(','));
					});
					$.cookie('infinity_cpanel_option_menu_states', states.join('|'), {expires: 7});
				}
			});

			// show all options for section
			$('a.infinity-cpanel-options-menu-showall', panel).button().click(function(){
				return false;
			});

			// cpanel options page menu item clicks
			$('div.infinity-cpanel-options-menu a.infinity-cpanel-options-menu-show', panel).bind('click',
				function(){
					loadOption($(this).attr('id'), panel);
					return false;
				}
			);

			// populate form if empty
			if (form.children().length < 1 && last) {
				// get states from cookie
				var om_states = $.cookie('infinity_cpanel_option_menu_states');
				// get the cookie?
				if (om_states != null) {
					// split at pipe
					om_states = om_states.split('|');
					// activate menus that were open
					if (om_states.length) {
						var om_state_idx, om_state_cur, om_state_menu, om_state_act, om_state_new;
						for (om_state_idx in om_states) {
							om_state_cur = om_states[om_state_idx].split(',');
							om_state_menu = $('#' + om_state_cur[0]);
							om_state_act = om_state_menu.accordion('option', 'active');
							om_state_new = ('false' == om_state_cur[1]) ? false : Number(om_state_cur[1]);
							if (om_state_act !== om_state_new) {
								om_state_menu.accordion('activate', om_state_new);
							}
						}
					}
				}
				// load last option
				loadOption(last, panel);
			}

			// load option screen
			function loadOption(id, panel)
			{
				// what to load?
				var load = id.split('___');

				// message element
				var message =
					$('div#infinity-cpanel-options-flash', panel)
						.pieEasyFlash('loading', 'Loading option editor.')
						.fadeIn();
				// empty the form
				form.empty();
				// send request for option screen
				$.post(
					pieEasyGlobalL10n.ajax_url,
					{
						'action': 'infinity_options_screen',
						'load_section': load[1],
						'load_option': (load[3]) ? load[3] : ''
					},
					function(r) {
						var sr = pieEasyAjax.splitResponseStd(r);
						if (sr.code >= 1) {
							// save as last option screen
							$.cookie('infinity_cpanel_option_loaded', id, {expires: 7});
							// inject options markup
							form.html(sr.content);
							// init docs and options
							initDocuments(panel);
							initOptions(panel);
							// remove message
							message.fadeOut().empty();
						} else {
							// error
							message.fadeOut(300, function(){
								message.pieEasyFlash('error', sr.content).fadeIn();
							})
						}
					}
				);
			}
		}

		// init doc pages
		function initDocuments(panel)
		{
			var anchor = 0;

			// recursive menu builder
			function buildDocMenu(menu, els_head)
			{
				var filter, did_one;

				els_head.each(function(){
					// name of anchor
					var a_name = 'menu_item_' + anchor++;
					// inject before self
					$(this).before($('<a></a>').attr('name', a_name));
					// create list item
					var item = $('<li></li>').appendTo(menu);
					var item_a = $('<a></a>').appendTo(item);
					var item_s = $('<ul></ul>');
					// build up link
					item_a.attr('target', '_self').attr('href', '#' + a_name).html($(this).html());
					// determine next level
					switch (this.tagName) {
						case 'H3':filter = 'h4';break;
						case 'H4':filter = 'h5';break;
						case 'H5':filter = 'h6';break;
						case 'H6':return false;
					}
					// next level headers
					var next = $(this).nextUntil(this.tagName).filter(filter);
					// build sub
					if ( buildDocMenu(item_s, next) ) {
						item.append(item_s);
					}
					// yay
					return did_one = true;
				});

				return did_one;
			}

			$('div.infinity-docs', panel).each(function(){
				var menu = $('ul.infinity-docs-menu', this);
				var headers = $('h3', this);
				buildDocMenu(menu, headers, 1);
			});
		}

		// initial load
		if ( cpanel.length ) {
			// initialize tabs
			initTabs();
		}

	});
})(jQuery);
var WebViewBundle = (function (exports, React) {
  'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var React__default = /*#__PURE__*/_interopDefaultLegacy(React);

  function _extends() {
    _extends = Object.assign ? Object.assign.bind() : function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
    return _extends.apply(this, arguments);
  }

  /**
   * A reusable button component.
   */
  const Button = ({
    text,
    onClick
  }) => /*#__PURE__*/React__default["default"].createElement("button", {
    onClick: onClick
  }, text);

  /**
   * Displays the dashboard's header.
   */
  const Header = ({
    lastUpdated,
    totalItems
  }) => /*#__PURE__*/React__default["default"].createElement("div", {
    className: "header"
  }, /*#__PURE__*/React__default["default"].createElement("div", null, "Last updated: ", lastUpdated), /*#__PURE__*/React__default["default"].createElement("div", null, totalItems, " items closed"), /*#__PURE__*/React__default["default"].createElement(Button, {
    text: "Refresh",
    onClick: () => {}
  }));

  /**
   * Represents a single item within a section, displaying its status, content, and actions.
   */
  const ItemRow = ({
    status,
    content
  }) => /*#__PURE__*/React__default["default"].createElement("div", {
    className: "itemRow"
  }, /*#__PURE__*/React__default["default"].createElement("span", null, status), /*#__PURE__*/React__default["default"].createElement("span", null, content));

  /**
   * A grid layout for items within a section.
   */
  const ItemGrid = ({
    items
  }) => /*#__PURE__*/React__default["default"].createElement("div", {
    className: "itemGrid"
  }, items.map((item, index) => /*#__PURE__*/React__default["default"].createElement(ItemRow, _extends({
    key: index
  }, item))));

  /**
   * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
   */
  const Section = ({
    name,
    description,
    items
  }) => /*#__PURE__*/React__default["default"].createElement("div", {
    className: "section"
  }, /*#__PURE__*/React__default["default"].createElement("h2", null, name), /*#__PURE__*/React__default["default"].createElement("p", null, description), /*#__PURE__*/React__default["default"].createElement(ItemGrid, {
    items: items
  }));

  // More imports as necessary

  /**
   * Dashboard component aggregating data and layout for the dashboard.
   */
  const Dashboard = ({
    data,
    dispatch,
    sendActionToPlugin
  }) => {
    const {
      sections,
      lastUpdated,
      totalItems
    } = data;
    return /*#__PURE__*/React__default["default"].createElement("div", {
      style: {
        maxWidth: '100vw',
        width: '100vw'
      }
    }, /*#__PURE__*/React__default["default"].createElement("div", {
      className: "dashboard"
    }, /*#__PURE__*/React__default["default"].createElement(Header, {
      lastUpdated: lastUpdated,
      totalItems: totalItems
    }), sections.map((section, index) => /*#__PURE__*/React__default["default"].createElement(Section, _extends({
      key: index
    }, section)))));
  };

  /****************************************************************************************************************************
   *                             WEBVIEW COMPONENT
   * This is your top-level React component. All other React components should be imported and included below
   ****************************************************************************************************************************/

  /****************************************************************************************************************************
   *                             CONSOLE LOGGING
   ****************************************************************************************************************************/
  // color this component's output differently in the console
  const consoleStyle = 'background: #222; color: #bada55'; //lime green
  const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args);

  /**
   * Root element for the Plugin's React Tree
   * @param {any} data
   * @param {Function} dispatch - function to send data back to the Root Component and plugin
   */
  function WebView({
    data,
    dispatch
  }) {
    /****************************************************************************************************************************
     *                             HOOKS
     ****************************************************************************************************************************/

    // GENERALLY SPEAKING YOU DO NOT WANT TO USE STATE HOOKS IN THE WEBVIEW COMPONENT
    // because the plugin may need to know what changes were made so when it updates data, it will be consistent
    // otherwise when the plugin updates data, it will overwrite any changes made locally in the Webview
    // instead of using hooks here, save updates to data using:
    // dispatch('UPDATE_DATA', {...data,changesToData})
    // this will save the data at the Root React Component level, which will give the plugin access to this data also
    // sending this dispatch will re-render the Webview component with the new data

    /****************************************************************************************************************************
     *                             VARIABLES
     ****************************************************************************************************************************/

    // destructure all the startup data we expect from the plugin
    const {
      pluginData,
      debug
    } = data;
    console.log(`Webview: data: ${JSON.stringify(data, null, 2)}`);
    console.log(`Webview: pluginData: ${JSON.stringify(pluginData, null, 2)}`);

    /****************************************************************************************************************************
     *                             HANDLERS
     ****************************************************************************************************************************/

    /****************************************************************************************************************************
     *                             EFFECTS
     ****************************************************************************************************************************/

    /**
     * When the data changes, console.log it so we know and scroll the window
     * Fires after components draw
     */
    React.useEffect(() => {
      logDebug(`Webview: useEffect: data changed. data: ${JSON.stringify(data)}`);
      if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
        debug && logDebug(`Webview: useEffect: data changed. Scrolling to ${String(data.lastWindowScrollTop)}`);
        window.scrollTo(0, data.passThroughVars.lastWindowScrollTop);
      }
    }, [data]);

    /**
     * Add the passthrough variables to the data object that will roundtrip to the plugin and come back in the data object
     * Because any data change coming from the plugin will force a React re-render, we can use this to store data that we want to persist
     * (e.g. lastWindowScrollTop)
     * @param {*} data
     * @returns
     */
    const addPassthroughVars = data => {
      const newData = {
        ...data
      };
      if (!newData.passThroughVars) newData.passThroughVars = {};
      newData.passThroughVars.lastWindowScrollTop = window.scrollY;
      return newData;
    };

    /**
     * Convenience function to send an action to the plugin and saving any passthrough data first in the Root data store
     * This is useful if you want to save data that you want to persist when the plugin sends data back to the Webview
     * For instance, saving where the scroll position was so that when data changes and the Webview re-renders, it can scroll back to where it was
     * @param {string} command
     * @param {any} dataToSend
     */
    const sendActionToPlugin = (command, dataToSend) => {
      const newData = addPassthroughVars(data); // save scroll position and other data in data object at root level
      dispatch('UPDATE_DATA', newData); // save the data at the Root React Component level, which will give the plugin access to this data also
      sendToPlugin([command, dataToSend]); // send action to plugin
    };

    /**
     * Send data back to the plugin to update the data in the plugin
     * This could cause a refresh of the Webview if the plugin sends back new data, so we want to save any passthrough data first
     * In that case, don't call this directly, use sendActionToPlugin() instead
     * @param {[command:string,data:any,additionalDetails:string]} param0
     */
    const sendToPlugin = ([command, data, additionalDetails = '']) => {
      if (!command) throw new Error('sendToPlugin: command must be called with a string');
      logDebug(`Webview: sendToPlugin: ${JSON.stringify(command)} ${additionalDetails}`, command, data, additionalDetails);
      if (!data) throw new Error('sendToPlugin: data must be called with an object');
      dispatch('SEND_TO_PLUGIN', [command, data], `WebView: sendToPlugin: ${String(command)} ${additionalDetails}`);
    };

    /****************************************************************************************************************************
     *                             RENDER
     ****************************************************************************************************************************/

    return /*#__PURE__*/React__default["default"].createElement(Dashboard, {
      data: pluginData,
      dispatch: dispatch,
      sendActionToPlugin: sendActionToPlugin
    });
  }

  exports.WebView = WebView;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({}, react);
Object.assign(typeof(globalThis) == "undefined" ? this : globalThis, WebViewBundle)

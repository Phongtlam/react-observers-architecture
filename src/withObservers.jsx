import React from "react";
// import ResizeObserver from "resize-observer-polyfill";
// import IntersectionObserver from "intersection-observer";
import PropTypes from "prop-types";
import ObserversContext from "./utils/observers-context";
import { lazyloadImage, isNewInstance } from "./utils/observers-utils";
import { INTERSECTION, RESIZE } from "./enums";

const OBSERVER_ROOT_ID = "root-observer";

const withObservers = (
  WrappedComponent,
  globalConfigs = {
    types: [],
    intersection: null
  }
) =>
  class ObserversProviderWrapper extends React.Component {
    constructor(props) {
      super(props);
      this.OBSERVER_ROOT_ELEMENT = React.createRef();
      this._setResizeObserverWindowDimension = this._setResizeObserverWindowDimension.bind(this);

      this.state = {
        resize: {
          currentWindowWidth: 0,
          currentWindowHeight: 0
        }
      };
      this.Observers = {
        resize: {
          observedElementsIds: {
            [OBSERVER_ROOT_ID]: [this._setResizeObserverWindowDimension]
          }
        }
      };
      this.ObserversInstances = this._createObservers();
      this._resizeObserverHandler = this._resizeObserverHandler.bind(this);
      this._intersectionObserverHandler = this._intersectionObserverHandler.bind(this);
      this._createImageLazyloadObserver = this._createImageLazyloadObserver.bind(this);
    }

    componentDidMount() {
      if (globalConfigs.types.indexOf(RESIZE) !== -1) {
        this.ObserversInstances.resize.observe(this.OBSERVER_ROOT_ELEMENT.current);
      }
    }

    _resizeObserverHandler(callback = [], observedElementRef) {
      // callback can be a single callback or an array of callback,
      // each will get mapped to the observed element ref
      if (observedElementRef) {
        if (!observedElementRef.id) {
          console.error("observedElementRef needs to have a unique id");
          return;
        }
        this.ObserversInstances.resize.observe(observedElementRef);
      }
      const newObservedId = observedElementRef ? observedElementRef.id : OBSERVER_ROOT_ID;
      const prevStateEntry = this.Observers.resize.observedElementsIds[newObservedId];
      this.Observers.resize = {
        ...this.Observers.resize,
        observedElementsIds: {
          ...this.Observers.resize.observedElementsIds,
          [newObservedId]: prevStateEntry ? prevStateEntry.concat(callback) : [callback]
        }
      };
    }

    _createObservers() {
      const observerTypes = globalConfigs.types;
      if (observerTypes.length === 0) {
        return;
      }
      return observerTypes.reduce((observersInstances, type) => {
        switch (type) {
          case RESIZE:
            observersInstances[type] = this._createResizeObserver();
            break;

          case INTERSECTION:
            observersInstances[type] = {
              lazyload: {}
            };
            break;

          default:
            observersInstances[type] = false;
            break;
        }
        return observersInstances;
      }, {});
    }

    _createResizeObserver() {
      return new ResizeObserver((entries, observer) => {
        entries.forEach(entry => {
          this._observersCallbacksRunner(entry, observer, "resize");
        });
      });
    }

    _createImageLazyloadObserver(
      componentName,
      observedElements,
      distanceToLoadFromViewport = "50px",
      advancedConfigs
    ) {
      this._intersectionObserverHandler(
        (entry, observer) => {
          if (entry.isIntersecting) {
            // start fetching the images
            lazyloadImage(entry.target);
            // Stop watching and load the image
            observer.unobserve(entry.target);
          }
        },
        componentName,
        observedElements,
        distanceToLoadFromViewport,
        advancedConfigs
      );
    }

    _intersectionObserverHandler(
      callback,
      componentName,
      observedElements,
      distanceToLoadFromViewport,
      advancedConfigs
    ) {
      if (typeof callback !== "function") {
        console.error("callback is not a function");
        return;
      }
      if (!componentName) {
        console.error("component name is required");
        return;
      }
      if (!observedElements || observedElements.length === 0) {
        console.error("An observed element or an array of observed elements is required");
        return;
      }

      if (isNewInstance(componentName, this.ObserversInstances.intersection.lazyload)) {
        // set lazyload configs
        let lazyloadConfig;
        if (globalConfigs.intersection) {
          // if global app config exists, use this
          lazyloadConfig = globalConfigs.intersection;
        } else if (advancedConfigs) {
          // else delegate to advancedConfigs option at module level
          lazyloadConfig = advancedConfigs;
        } else {
          // default config for lazyload
          lazyloadConfig = {
            rootMargin: `0px 0px ${distanceToLoadFromViewport || "0px"} 0px`
          };
        }

        this.ObserversInstances.intersection.lazyload[
          componentName
        ] = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => callback(entry, observer));
        }, lazyloadConfig);
      }

      if (Array.isArray(observedElements)) {
        observedElements.forEach(el => {
          this.ObserversInstances.intersection.lazyload[componentName].observe(el);
        });
      } else {
        this.ObserversInstances.intersection.lazyload[componentName].observe(observedElements);
      }

      return this.ObserversInstances.intersection.lazyload[componentName];
    }

    _observersCallbacksRunner(entry, observer, observerType) {
      // each callback will return both the entry and the observer for more advanced config
      this.Observers[observerType].observedElementsIds[entry.target.id].forEach(callback => {
        callback(entry, observer);
      });
    }

    _setResizeObserverWindowDimension(entry) {
      if (entry.target.id === OBSERVER_ROOT_ID) {
        this.setState(prevState => ({
          resize: {
            ...prevState.resize,
            currentWindowWidth: entry.contentRect.width,
            currentWindowHeight: entry.contentRect.height
          }
        }));
      }
    }

    _createObserversPassthroughContextApis() {
      return globalConfigs.types.reduce((hashApis, type) => {
        switch (type) {
          case RESIZE:
            hashApis[type] = {
              handler: this._resizeObserverHandler,
              instance: ResizeObserver,
              getCurrentWindowDimension: () => ({
                width: this.state.resize.currentWindowWidth,
                height: this.state.resize.currentWindowHeight
              })
            };
            break;

          case INTERSECTION:
            hashApis[type] = {
              instance: IntersectionObserver,
              lazyloadImg: this._createImageLazyloadObserver,
              handler: this._intersectionObserverHandler
            };
            break;

          default:
            hashApis[type] = null;
            break;
        }
        return hashApis;
      }, {});
    }

    render() {
      return (
        <React.Fragment>
          <div
            id={OBSERVER_ROOT_ID}
            style={{ position: "absolute", width: "100vw", height: "100vh", zIndex: "-1" }}
            ref={this.OBSERVER_ROOT_ELEMENT}
          />
          <ObserversContext.Provider value={this._createObserversPassthroughContextApis()}>
            <WrappedComponent {...this.props} />
          </ObserversContext.Provider>
        </React.Fragment>
      );
    }
  };

withObservers.propTypes = {
  WrappedComponent: PropTypes.element.isRequired,
  globalConfigs: PropTypes.shape({
    types: PropTypes.oneOf([INTERSECTION, RESIZE])
  })
};

export default withObservers;

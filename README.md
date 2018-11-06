# Observers APIs

This is the Documentation on how to use this Observers APIs, built on ResizeObserver and IntersectionObserver Web APIs. This is recommended over adding and removing event handlers at either App or Component levels since observers are running asynchronously off the main thread

This is a `React 16` only API since it is used with many features only available in v16, such as the new Context API to thread methods to component level without using the Redux store

## API setup

On the root of your app, import intersectionObserverEnabled and resizeObserverEnabled to check if polyfill is needed before import in the module

```
  import { intersectionObserverEnabled } from "@walmart/feds-ny-core/lib/base/helpers/intersection-observer";
  import { resizeObserverEnabled } from "@walmart/feds-ny-core/lib/base/helpers/resize-observer";

  ...

  if (!intersectionObserverEnabled()) {
    ... conditionally require("intersection-observer");
  }


  if (!resizeObserverEnabled()) {
    ... conditionally require("resize-observer-polyfill");
  } 
```

- withObservers

Import the withObservers wrapper at top level App Component, or any ancestor of elements that you want to consume the APIs
```
  import withObservers from "@walmart/feds-ny-core/lib/common/components/withObservers";
  
  ...
  export default withObservers(App, {
    types: ["resize", "intersection"]
  });
```

`withObservers` function takes in 2 parameters. The first one is the Component, the second one is a globalConfigs

>globalConfigs is an object with a types as an array to specify what observers we want to use as well as global options for intersection/resize observers.

>Warning: Setting a global config will override all other configs in component methods. Advise to set configs per API method call

- withObserversConsumer

At the components that need the Observers
```
  import withObserversConsumer from "@walmart/feds-ny-core/lib/common/components/withObserversConsumer";
```

This extra import might be needed for ResizeObserver currently to use `this.props.Observers.resize.getCurrentWindowDimension()`
```
  import { canUseDOM } from "exenv";
  ...
  if (canUseDOM) {
    const dimension = this.props.Observers.resize.getCurrentWindowDimension();
    const width = dimension.width;
    const height = dimension.height;
  }
```

This is due to the DOM not existing on SSR, while the library trying to set the initial value of screen dimension. All other methods work without needing to check for DOM usage on intial render

Finally we connect this with the currentComponent
```
  export default withObserversConsumer(OurComponent);
```

This works with Redux connect also
```
  export default connect(mapStateToProps)(withObserversConsumer(OurConnectedComponent));
```

## Usage

- ResizeObserver
  
  Access through this.props.Observers.resize[METHOD_NAME]

  - `this.props.Observers.resize.instance`: This is the instance of ResizeObserver. Can be used to directly create a new ResizeObserver instance with `const newResizeObserver = new this.props.Observers.resize.instance();`

  - `this.props.Observers.resize.handler(callback, observedElementRef)`: This is the callback handler for ResizeObserver.

    **Important**: This is a many to one relationship between callbacks and observed element. For each observed element, there is an array of callbacks that are mapped and will run in sequence once the observed element gets resized.

    - callback: This can be a single callback, or an array of callbacks. Each callback will have an `entry` and `observer` passed into its params

      The `entry` has a 2 key properties. First one is the `contentRect` which has the values of the observed element, default to OBSERVER_ROOT_ELEMENT that covers the entire viewport. The second is `target`, which is the DOM element

      The `observer` is the ResizeObserver itself

      **Important**: Be mindful that this callback is going to run for EVERY entry, so the best practice here is to make sure it is not running every time if you do not want it to. This is conscious by design since you might want it to be run for every single resizer. The example below restricts the callback to only `do something` when the ID matched

      ```
        const callback = (entry, observer) => {
          if (entry.target.id !== SOME_ID_THAT_YOU_MAKE) {
            ...do something
          }
        }
      ```

    - observedElementRef: This is an optional param to change the observed element. This is default to the OBSERVER_ROOT_ELEMENT

      **Important**: The new observed element will HAVE to contain a unique id. The reason is that each observed element is a key and all callbacks related to this observed element will be called in sequence whenever this particular element gets resized

      We can obtain this observedElementRef in 1 of 2 ways. Either via `document.getElementById("your-element-id")` or via React ref `this.reactRef.current`

      **Good Practice**: Do not observe the document body or other elements if we only need to run callbacks based on the whole screen resizing. Also we should be mindful that every time this parameter gets called, it will create a new entry in the dictionary. Generally, this parameter should be left as `undefined`

  - `this.props.Observers.resize.getCurrentWindowDimension`: This is meant to replace adding and removing eventListeners on the DOM to detect page resize.

    >**Important**: `canUseDOM` is needed for this method

    Simply call by:
    ```
      import { canUseDOM } from "exenv";
      ...
      if (canUseDOM) {
        const dimension = this.props.Observers.resize.getCurrentWindowDimension();
        const width = dimension.width;
        const height = dimension.height;
      }
    ```

    Everytime there is a page resize action, it will update and stream back the currentWindowDimension

- IntersectionObserver

  Access through `this.props.Observers.intersection[METHOD_NAME]`

    - `this.props.Observers.intersection.instance`: This is the instance of ResizeObserver. Can be used to directly create a new ResizeObserver instance with `const newIntersectionObserver = new this.props.Observers.intersection.instance();`

    - `this.props.Observers.intersection.lazyload`: This is an API for lazyload. As opposed to `ResizeObserver`, this is a one to many relationship between a callback and observed elements. We want to have a single callback, to load many observed elements when elements are coming into the viewport 

      Simply call by:

      ```
        this.props.Observers.intersection.lazyload(callback, componentName, observedElements, distanceToLoadFromViewport, advancedConfigs);
      ```

      - callback: This is the single callback, mapped to all observed elements. This callback will have 2 parameters returned, similar to `ResizeObserver`. This has both `entry` and also the `observer` itself to be returned. 

        The `entry` has a different interface than the one in `ResizeObserver`. Each entry describes an intersection change for one observed

        >Each entry describes an intersection change for one observed
        target element:
        
        - `entry.boundingClientRect`: A rectangle for the observed element itself
        - `entry.intersectionRatio`: Similar to `isIntersecting` but has more values rather than a simple boolean. The ratio of intersectionRect area to boundingClientRect area
        - `entry.intersectionRect`: An area of the “capturing frame” intersected by the observed element
        - `entry.isIntersecting`: A bool to check if even 1 pixel of the observed element touches the viewport (or the root element)
        - `entry.rootBounds`: A rectangle for the “capturing frame” (root + rootMargin)
        - `entry.target`: The original element that had been passed to observe() function of your Observer. Similar to event.target when working with events
        - `entry.time`: The timestamp corresponds to the time the intersection was recorded, relative to the time origin of the global object associated with the IntersectionObserver instance that generated the notification. (from W3 specs)

        For full list of properties, check the docs here https://w3c.github.io/IntersectionObserver/#intersection-observer-entry

        Simply call by:

        ```
          callback((entry, observer) => {
            doSomethingWithEntry(entry);

            // we should try to unobserve the entry target once it gets into view to reduce noise on the page and callbacks to be run too often

            observer.unobserve(entry.target)
          });
        ```

        The `observer` is the actual instance

      - componentName: This is in String format. This is an entry that is unique to that function call, mapped to a particular instance of this `IntersectionObserver`. Generally speaking, we should pass the name of the Component into this field

      - distanceToLoadFromViewport: This is the distance `below` the viewport in which the callback method should start running. This is defaulted to `0px`, which will runs the callback only when the observed element intersecting with the viewport. Can be both percentage or px value

      - advancedConfigs: This takes precedented over `distanceToLoadFromViewport` if being set, this is an object with a few params. Can be left blank usually

        ```
          const advancedConfigs = {
            root: rootObservedElement || viewport,
            rootMargin: "0px 0px 0px 0px",
            thresholds: [0]
          }
        ```

        Read more about this on https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API

    - `this.props.Observers.intersection.lazyloadImg`: This is built using the above `lazyload` API. Usage is the same minus the passed in callback. Simply observe elements to be lazyloaded.

      ```
        this.props.Observers.intersection.lazyloadImg(componentName, observedElements, distanceToLoadFromViewport, advancedConfigs);
      ```
      The only caveat here is that each `<img />` tag needs to use `data-src` attribute rather than `src` for the image url.

      ```
        <img data-src="https:/your-img-location.com/something" />
      ``` 


import React from "react";
import ObserversContext from "./utils/observers-context";

const withObserversConsumer = WrappedComponent =>
  class ObserversConsumerWrapper extends React.PureComponent {
    constructor(props) {
      super(props);
    }

    render() {
      return (
        <ObserversContext.Consumer>
          {observersContext => <WrappedComponent Observers={observersContext} {...this.props} />}
        </ObserversContext.Consumer>
      );
    }
  };

export default withObserversConsumer;

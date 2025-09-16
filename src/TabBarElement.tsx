// UI Components imports
import React, { useEffect, useState } from "react";
import {
  CommonActions,
  Descriptor,
  NavigationState,
  PartialState,
  Route,
  TabNavigationState,
} from "@react-navigation/native";
import {
  BackHandler,
  Dimensions,
  I18nManager,
  NativeEventSubscription,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { ScreenContainer } from "react-native-screens";
import ResourceSavingScene from "./ResourceSavingScene";
import { IAppearanceOptions, TabElementDisplayOptions } from "./types";
import { BottomTabBarWrapper, Dot, Label, TabButton } from "./UIComponents";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";

interface TabBarElementProps {
  state: TabNavigationState<Record<string, object | undefined>>;
  navigation: any;
  descriptors: Record<string, Descriptor<any, any, any>>;
  appearance: IAppearanceOptions;
  tabBarOptions?: any;
  lazy?: boolean;
}

/**
 * @name TabBarElement
 * React Navigation v5 custom navigation (bottom tab bar) builder with an
 * an interactive animation, and easily customizable.
 *
 * @param state Navigation state
 * @param navigation Navigation object
 * @param descriptors
 * @param appearance Object with appearance configurations (see readme)
 * @param rest
 *
 * @return function that creates the custom tab bar
 */
export default ({
  state,
  navigation,
  descriptors,
  appearance,
  tabBarOptions,
  lazy,
}: TabBarElementProps) => {
  // Appearance options destruction
  const {
    topPadding,
    bottomPadding,
    horizontalPadding,
    tabBarBackground,
    activeTabBackgrounds,
    activeColors,
    floating,
    dotCornerRadius,
    whenActiveShow,
    whenInactiveShow,
    dotSize,
    shadow,
    tabButtonLayout,
  } = appearance;

  const {
    activeTintColor,
    inactiveTintColor,
    activeBackgroundColor,
    tabStyle,
    labelStyle,
  } = tabBarOptions;

  // State
  const animatedPos = useSharedValue(horizontalPadding);
  const prevPos = useSharedValue(horizontalPadding);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const [loaded, setLoaded] = useState([state.index]);
  const insets = useSafeAreaInsets();
  const [isPortrait, setIsPortrait] = useState(true);

  useEffect(() => {
    const { index } = state;
    setLoaded(loaded.includes(index) ? loaded : [...loaded, index]);
  }, [state]);

  /**
   * @returns true if current orientation is Portrait, false otherwise
   */
  const didChangeToPortrait = () => {
    const dim = Dimensions.get("screen");
    return dim.height >= dim.width;
  };

  /**
   * Helper function that updates the previous position
   * of the tab to calculate the new position.
   */
  const updatePrevPos = () => {
    prevPos.value = animatedPos.value;
  };

  /**
   * Handles physical button press for Android
   */
  const handleBackPress = () => {
    animatedPos.value = withSpring(animatedPos.value, {}, () => {
      runOnJS(updatePrevPos)();
    });
    return false;
  };

  useEffect(() => {
    animatedPos.value = withSpring(animatedPos.value, {}, () => {
      runOnJS(updatePrevPos)();
    });
    let backHandlerSubscription: NativeEventSubscription | undefined;

    if (Platform.OS === "android") {
      backHandlerSubscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackPress
      );
    }

    const subscription = Dimensions.addEventListener("change", () => {
      if (
        (isPortrait && !didChangeToPortrait()) ||
        (!isPortrait && didChangeToPortrait())
      ) {
        setIsPortrait(!isPortrait);
        animatedPos.value = withSpring(animatedPos.value, {}, () => {
          runOnJS(updatePrevPos)();
        });
      }
    });

    return () => {
      if (Platform.OS === "android") {
        backHandlerSubscription?.remove();
      }
      subscription?.remove();
    };
  }, []);

  // Compute activeBackgroundColor, if array provided, use array otherwise fallback to
  // default tabBarOptions property activeBackgroundColor (fallbacks for all unspecified tabs)
  const activeTabBackground = activeTabBackgrounds
    ? Array.isArray(activeTabBackgrounds)
      ? activeTabBackgrounds[state.index] || activeBackgroundColor
      : activeTabBackgrounds
    : activeBackgroundColor;

  // Compute activeBackgroundColor, if array provided, use array otherwise fallback to
  // default tabBarOptions property activeTintColor (fallbacks for all unspecified tabs)
  const activeColor = activeColors
    ? Array.isArray(activeColors)
      ? activeColors[state.index] || activeTintColor
      : activeColors
    : activeTintColor;

  const animatedDotStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: I18nManager.isRTL
            ? -animatedPos.value
            : animatedPos.value,
        },
      ],
      width: width.value,
      height: height.value,
    };
  });

  /**
   * Create a tab button given a route and route index
   * @param {*} route
   * @param {*} routeIndex
   * @returns React.Node with the button component
   */
  const createTab = (
    route: Route<string> & {
      state?: NavigationState | PartialState<NavigationState> | undefined;
    },
    routeIndex: number
  ) => {
    const focused = routeIndex == state.index;
    const { options } = descriptors[route.key];
    const tintColor = focused ? activeColor : inactiveTintColor;

    const icon = options.tabBarIcon;

    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name;

    const accessibilityLabel =
      options.tabBarAccessibilityLabel !== undefined
        ? options.tabBarAccessibilityLabel
        : typeof label === "string"
        ? `${label}, tab, ${routeIndex + 1} of ${state.routes.length}`
        : undefined;

    // Render the label next to the icon
    // only if showLabel is true
    const renderLabel = () => {
      if (typeof label === "string") {
        return (
          <Label
            tabButtonLayout={tabButtonLayout}
            whenActiveShow={whenActiveShow}
            whenInactiveShow={whenInactiveShow}
            style={labelStyle}
            activeColor={tintColor}
          >
            {label}
          </Label>
        );
      } else {
        return label({ focused, color: activeColor });
      }
    };

    /**
     * Helper function to render the icon
     */
    const renderIcon = () => {
      if (icon === undefined) {
        return null;
      }

      let defaultIconSize = 20;
      return icon({ focused, color: tintColor, size: defaultIconSize });
    };

    /**
     * On Press Handler
     * Emits an event to the navigation
     */
    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!focused && !event.defaultPrevented) {
        navigation.dispatch({
          ...CommonActions.navigate(route.name),
          target: state.key,
        });
      }
    };

    /**
     * On Long Press Handler
     * Emits an event to the navigation
     */
    const onLongPress = () => {
      navigation.emit({
        type: "tabLongPress",
        target: route.key,
      });
    };

    /**
     * Read the position and dimension of a tab.
     * and update animation state
     * @param {*} e
     */
    const onLayout = (e: any) => {
      if (focused) {
        prevPos.value = animatedPos.value;
        animatedPos.value = withSpring(e.nativeEvent.layout.x, {}, () => {
          runOnJS(updatePrevPos)();
        });
        width.value = e.nativeEvent.layout.width;
        height.value = e.nativeEvent.layout.height;
      }
    };

    const labelAndIcon = () => {
      if (focused) {
        switch (whenActiveShow) {
          case TabElementDisplayOptions.BOTH:
            return (
              <React.Fragment>
                <View>{renderIcon()}</View>
                {renderLabel()}
              </React.Fragment>
            );
          case TabElementDisplayOptions.LABEL_ONLY:
            return renderLabel();
          case TabElementDisplayOptions.ICON_ONLY:
            return renderIcon();
          default:
            return (
              <React.Fragment>
                <View>{renderIcon()}</View>
                {renderLabel()}
              </React.Fragment>
            );
        }
      } else {
        switch (whenInactiveShow) {
          case TabElementDisplayOptions.BOTH:
            return (
              <React.Fragment>
                <View>{renderIcon()}</View>
                {renderLabel()}
              </React.Fragment>
            );
          case TabElementDisplayOptions.LABEL_ONLY:
            return renderLabel();
          case TabElementDisplayOptions.ICON_ONLY:
            return renderIcon();
          default:
            return (
              <React.Fragment>
                <View>{renderIcon()}</View>
                {renderLabel()}
              </React.Fragment>
            );
        }
      }
    };

    return (
      <TabButton
        key={route.key}
        focused={focused}
        labelLength={label.length}
        accessibilityLabel={accessibilityLabel}
        onLayout={onLayout}
        onPress={onPress}
        onLongPress={onLongPress}
        dotSize={dotSize}
        tabButtonLayout={tabButtonLayout}
      >
        {labelAndIcon()}
      </TabButton>
    );
  };

  const { overlayStyle } = StyleSheet.create({
    overlayStyle: {
      top: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      position: "absolute",
    },
  });

  const { options } = descriptors[state.routes[state.index].key];
  const tabBarVisible =
    options.tabBarVisible == undefined ? true : options.tabBarVisible;
  return (
    <React.Fragment>
      {/* Current Screen */}
      <View
        style={{
          flex: 1,
          overflow: "hidden",
        }}
      >
        <ScreenContainer style={{ flex: 1 }}>
          {state.routes.map((route, index) => {
            const descriptor = descriptors[route.key];
            const { unmountOnBlur } = descriptor.options;
            const isFocused = state.index === index;

            if (unmountOnBlur && !isFocused) {
              return null;
            }

            if (lazy && !loaded.includes(index) && !isFocused) {
              // Don't render a screen if we've never navigated to it
              return null;
            }

            return (
              <ResourceSavingScene
                key={route.key}
                isVisible={isFocused}
                style={StyleSheet.absoluteFill}
              >
                <View
                  accessibilityElementsHidden={!isFocused}
                  importantForAccessibility={
                    isFocused ? "auto" : "no-hide-descendants"
                  }
                  style={{ flex: 1 }}
                >
                  {descriptor.render()}
                </View>
              </ResourceSavingScene>
            );
          })}
        </ScreenContainer>
      </View>
      {/* Tab Bar */}
      {tabBarVisible && (
        <View pointerEvents={"box-none"} style={floating && overlayStyle}>
          <BottomTabBarWrapper
            style={tabStyle}
            floating={floating}
            topPadding={topPadding}
            bottomPadding={bottomPadding + insets.bottom}
            horizontalPadding={horizontalPadding}
            tabBarBackground={tabBarBackground}
            shadow={shadow}
          >
            {state.routes.map(createTab)}
            {/* Animated Dot / Background */}
            <Dot
              dotCornerRadius={dotCornerRadius}
              topPadding={topPadding}
              activeTabBackground={activeTabBackground}
              style={animatedDotStyle}
              width={width}
              height={height}
            />
          </BottomTabBarWrapper>
        </View>
      )}
    </React.Fragment>
  );
};

// utils functions for Observers

export const lazyloadImage = function(img) {
  // function to lazy load images, replace data-src with src
  const dataSrc = img.getAttribute("data-src");
  if (!dataSrc) {
    return;
  }
  img.src = dataSrc;
};

export const isNewInstance = function(key, set) {
  return !set[key];
};

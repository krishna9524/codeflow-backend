#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>

#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    void reverseArray(vector<int>& arr) {
        int n = arr.size();
        for (int i = 0; i < n / 2; i++) {
            swap(arr[i], arr[n - i - 1]);
        }
    }
};



                    int main() {
                        for (int i = 0; i < 100000; ++i) {
                            // Reset cin for each loop iteration
                            std::cin.clear();
                            std::cin.seekg(0);
                            
    int n;
    std::cin >> n;
    std::vector<int> arr(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> arr[i];
    }

    Solution sol;
    sol.reverseArray(arr);

    for (int i = 0; i < n; ++i) {
        std::cout << arr[i] << (i == n - 1 ? "" : " ");
    }
    std::cout << std::endl;

    

                        }
                        return 0;
                    }
                